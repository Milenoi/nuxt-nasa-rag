<script setup lang="ts">
// The Ask page: the RAG front end. A question goes to POST /api/ask, which
// embeds it, retrieves the closest APOD texts by cosine similarity, and has
// Gemini write a grounded answer. Five states drive the whole UI:
//   idle → loading → answer   (with sources)
//                  ↘ empty    (nothing above the relevance threshold)
//                  ↘ error    (request failed)
// The pipeline footer mirrors `status` via useAskStatus().
import { marked } from 'marked'
import Autoplay from 'embla-carousel-autoplay'
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel'
import { Slider } from '@/components/ui/slider'
import { ChevronDown, Play } from '@lucide/vue'
import type { Source, AskResponse } from '~/types/ask'

const { data: content } = await useFetch('/api/content', { key: 'content' })
const { status, timing } = useAskStatus()
const route = useRoute()
const router = useRouter()

useSeoMeta({
  title: 'APOD Ask: ask the stars',
  description:
    'Ask an astronomy question and get an answer grounded in real NASA Astronomy Picture of the Day descriptions, with the source images.'
})

const hero = computed(() => content.value?.hero)
const ask = computed(() => content.value?.ask)
const answerCopy = computed(() => content.value?.answer)
const states = computed(() => content.value?.states)
const a11y = computed(() => content.value?.a11y)

const query = ref('')
const queryEcho = ref('')
const answer = ref('')
// Sanitized HTML of the rendered Markdown answer (built in the watcher below).
const answerHtml = ref('')
const sources = ref<Source[]>([])
// Embla drives the source carousel (scroll / drag / autoplay). We hold its API so
// we can re-measure and jump back to the start after a hero swap changes the row.
const carouselApi = ref<CarouselApi>()
// Whether the arrows can still page in each direction, kept in sync with Embla's
// own scroll state so the buttons disable at the ends, like the old slider did.
const canScrollPrev = ref(false)
const canScrollNext = ref(false)
// Autoplay pages the row gently. stopOnMouseEnter pauses it while the pointer is over
// the row (or dragging), but stopOnInteraction:false lets it resume once the pointer
// leaves, so it never dies for good. playOnInit:false lets us skip it entirely under
// prefers-reduced-motion.
const autoplayPlugins = [
  Autoplay({ delay: 4500, stopOnMouseEnter: true, stopOnInteraction: false, playOnInit: false })
]
// A short, human-readable reason shown on the error screen so it's clear WHY
// the request failed (e.g. the Gemini quota) versus genuinely finding nothing.
const errorDetail = ref('')
// Gentle nudge when someone hits Ask with an empty field.
const askHint = ref('')
// Example prompts start collapsed behind a toggle so the idle screen stays calm.
const showExamples = ref(false)
// True when the model replied it can't answer from the sources (off-topic /
// nonsense), which earns the playful roast instead of the neutral copy.
const emptyOffTopic = ref(false)
const emptyMessage = computed(() =>
  emptyOffTopic.value
    ? states.value?.nonsense ?? ''
    : `${states.value?.empty ?? ''} ${states.value?.emptyHintSuffix ?? ''}`.trim()
)
// Which source is shown big in the hero. 0 = the top match (the answer hero);
// clicking another source card swaps the hero to that picture.
const heroIndex = ref(0)

// Relevance tolerance: the cutoff a source's score must clear to count as relevant.
// The slider exposes it; DEFAULT_THRESHOLD mirrors the backend default. `threshold`
// drives the live dimming (client-only, free). `lastAskedThreshold` is the value the
// current answer was actually fetched with, so we know when re-asking would change
// anything.
const DEFAULT_THRESHOLD = 0.55
const threshold = ref(DEFAULT_THRESHOLD)
const lastAskedThreshold = ref(DEFAULT_THRESHOLD)
// reka-ui's Slider supports multiple thumbs, so its v-model is an array.
const thresholdModel = computed({
  get: () => [threshold.value],
  set: (value: number[]) => { threshold.value = value[0] ?? DEFAULT_THRESHOLD }
})
// Only worth re-asking once the slider moved off the value we last searched with.
const thresholdChanged = computed(() => Math.abs(threshold.value - lastAskedThreshold.value) > 0.001)
// True once the slider filters out every source: the shown answer + hero no longer
// reflect a valid result, so we mask them with a tolerance-empty state.
const allBelowThreshold = computed(() =>
  status.value === 'answer' && sources.value.length > 0 && sources.value.every((s) => s.score < threshold.value)
)

// Announced to assistive tech + used to move focus when a state change happens,
// so the result isn't silent once the loader is removed from the DOM.
const liveMessage = ref('')
const answerHeading = ref<HTMLElement | null>(null)
const emptyHeading = ref<HTMLElement | null>(null)
const errorHeading = ref<HTMLElement | null>(null)

// The Gemini answer is Markdown. `marked` does not strip raw HTML, so even though
// the text comes from our own grounded route we sanitize the rendered HTML before
// injecting it. DOMPurify loads on the client only, the 'answer' state is always
// reached via a client-side request, so it never enters the server bundle.
watch(answer, async (md) => {
  if (!md) {
    answerHtml.value = ''
    return
  }
  const html = marked.parse(md) as string
  if (import.meta.client) {
    const { default: DOMPurify } = await import('dompurify')
    answerHtml.value = DOMPurify.sanitize(html)
  } else {
    answerHtml.value = html
  }
})

const topMatch = computed(() => sources.value[0])
const heroSource = computed(() => sources.value[heroIndex.value] ?? topMatch.value)
const heroIsTop = computed(() => heroIndex.value === 0)

// aria-label for a source card, built from content ("Show {title} in the hero").
const heroCardLabel = (title: string) =>
  (answerCopy.value?.showInHero ?? '').replace('{title}', title)

// Announce the new state and move focus to its heading, once the DOM has updated.
function announce(message: string, target: { value: HTMLElement | null }) {
  liveMessage.value = message
  nextTick(() => target.value?.focus())
}

// A monotonic request id: if two requests are ever in flight, only the newest is
// allowed to write the result, a slower earlier response is discarded.
let requestId = 0

// Build the shareable URL query. `t` (the tolerance) is always included so the
// link is explicit about it; `hero` is omitted at 0 (the top match).
function shareQuery(q: string, hero: number, tol: number): Record<string, string> {
  const query: Record<string, string> = { q, t: tol.toFixed(2) }
  if (hero > 0) query.hero = String(hero)
  return query
}

async function submit() {
  const q = query.value.trim()
  if (!q) {
    askHint.value = ask.value?.emptyHint ?? 'Please ask something first.'
    return
  }
  askHint.value = ''
  // Reflect the query + tolerance in the URL so the result is shareable.
  // (heroIndex resets to 0 just below, so a fresh ask carries no hero param.)
  router.replace({ query: shareQuery(q, 0, threshold.value) })
  const id = ++requestId
  status.value = 'loading'
  timing.value = null
  heroIndex.value = 0
  answer.value = ''
  const started = performance.now()
  try {
    const data = await $fetch<AskResponse>('/api/ask', {
      method: 'POST',
      body: { question: q, threshold: threshold.value }
    })
    if (id !== requestId) return
    lastAskedThreshold.value = threshold.value
    queryEcho.value = data.question || q
    timing.value = `${((performance.now() - started) / 1000).toFixed(2)} s`

    if (data.answer) {
      // A grounded answer came back: show it with its sources.
      sources.value = data.sources ?? []
      answer.value = data.answer
      status.value = 'answer'
      announce(a11y.value?.answerReady ?? '', answerHeading)
    } else {
      // Nothing above the threshold, or the model ruled the question off-topic.
      sources.value = []
      emptyOffTopic.value = Boolean(data.offTopic)
      status.value = 'empty'
      announce(a11y.value?.noResults ?? '', emptyHeading)
    }
  } catch (err) {
    if (id !== requestId) return
    timing.value = null
    errorDetail.value = describeError(err)
    status.value = 'error'
    announce(a11y.value?.requestError ?? '', errorHeading)
  }
}

function useExample(example: string) {
  query.value = example
  submit()
}

function clearLocal() {
  query.value = ''
  answer.value = ''
  sources.value = []
  queryEcho.value = ''
  heroIndex.value = 0
  errorDetail.value = ''
  emptyOffTopic.value = false
  liveMessage.value = ''
}

function reset() {
  clearLocal()
  timing.value = null
  status.value = 'idle'
}

// The logo (in the header) resets the shared status to 'idle' from anywhere,
// mirror that here by clearing the page's own state when it happens.
watch(status, (value) => {
  if (value === 'idle') {
    clearLocal()
    // Drop the ?q= param so a reset also gives a clean, shareable idle URL.
    if (route.query.q) router.replace({ query: {} })
  }
})

// Keep the tolerance live in the URL as the slider moves (debounced, so it isn't
// replaced on every pixel). Carries the question + hero when there's a result.
let tUrlTimer: ReturnType<typeof setTimeout> | undefined
watch(threshold, (t) => {
  clearTimeout(tUrlTimer)
  tUrlTimer = setTimeout(() => {
    const q = typeof route.query.q === 'string' ? route.query.q : ''
    router.replace({ query: q ? shareQuery(q, heroIndex.value, t) : { t: t.toFixed(2) } })
  }, 250)
})

// `status` is shared state that outlives this page, but the answer/sources data
// is local and is gone after we navigate away. So returning to this page (nav
// back from another route, browser back) with a stale 'answer'/'error' status
// would render an empty answer view. Always start clean on (re)mount.
onMounted(async () => {
  // A deep link like /?q=...&hero=N runs the search automatically and restores
  // the featured source card (shareable URL).
  const shared = route.query.q
  const heroParam = route.query.hero
  // Restore a shared tolerance BEFORE searching, so the auto-run honours it.
  const tParam = route.query.t
  if (typeof tParam === 'string') {
    const t = Number(tParam)
    if (!Number.isNaN(t)) threshold.value = Math.min(1, Math.max(0, t))
  }
  if (typeof shared === 'string' && shared.trim()) {
    query.value = shared
    await submit()
    const h = Number(heroParam)
    if (Number.isInteger(h) && h > 0 && h < sources.value.length) {
      heroIndex.value = h
      router.replace({ query: shareQuery(shared, h, threshold.value) })
    }
  } else if (status.value !== 'idle') {
    reset()
  }
})

// Typing dismisses the empty-field nudge.
watch(query, () => {
  if (askHint.value) askHint.value = ''
})

// The carousel shows every source EXCEPT the one currently in the hero; clicking
// a card promotes it, and the previously featured match drops back into the row.
const sliderSources = computed(() =>
  sources.value
    .map((src, index) => ({ src, index }))
    .filter((item) => item.index !== heroIndex.value)
)

// Grab Embla's API on mount, track the scroll state for the arrows, and start
// autoplay, unless the visitor asked for less motion, in which case drag and the
// arrows still work, it just doesn't page itself.
function onCarouselInit(api: CarouselApi) {
  carouselApi.value = api
  const sync = () => {
    canScrollPrev.value = api?.canScrollPrev() ?? false
    canScrollNext.value = api?.canScrollNext() ?? false
  }
  api?.on('select', sync)
  api?.on('reInit', sync)
  sync()
  // Start autoplay via the API's plugin handle, but on the NEXT frame. Calling
  // play() synchronously inside init-api runs before Autoplay's own init settles
  // (playOnInit:false), so it no-ops; deferring one frame makes it stick.
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduce) requestAnimationFrame(() => api?.plugins().autoplay?.play())
}

// Promoting a card into the hero changes which cards the row holds, so Embla has to
// re-measure and snap back to the first card.
watch(sliderSources, async () => {
  await nextTick()
  carouselApi.value?.reInit()
  carouselApi.value?.scrollTo(0, true)
})

// Clicking a source card lifts it into the hero, resets the row to the start, and
// scrolls back up so the swap is visible (honouring reduced-motion).
function selectSource(index: number) {
  heroIndex.value = index
  // Reflect the featured source in the URL (omit for the top match / index 0).
  // Keep q + the tolerance the current answer was fetched with; add/drop hero.
  const q = typeof route.query.q === 'string' ? route.query.q : ''
  router.replace({ query: shareQuery(q, index, lastAskedThreshold.value) })
  if (import.meta.client) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }
}

</script>

<template>
  <div class="relative">
    <!-- Screen-reader announcement for Ask state changes (visually hidden). -->
    <p
      class="sr-only"
      role="status"
      aria-live="polite"
    >
      {{ liveMessage }}
    </p>

    <!-- ═══════════ IDLE, the hero + ask box ═══════════ -->
    <section
      v-if="status === 'idle'"
      class="mx-auto flex min-h-[calc(100dvh-3.25rem)] max-w-[820px] flex-col px-5 pb-16 pt-24 animate-fade-up md:px-8 md:pt-[19vh]"
    >
      <p class="mb-6 text-sm text-text-faint">
        {{ hero?.eyebrow }}
      </p>
      <h1 class="font-serif text-[clamp(44px,8vw,78px)] font-light leading-[1.02] tracking-[-0.015em] text-text-strong">
        {{ hero?.title }}
      </h1>
      <p class="mt-6 max-w-[540px] text-lg leading-relaxed text-text-secondary">
        {{ hero?.subtitle }}
      </p>

      <form
        class="mt-10 max-w-[680px]"
        @submit.prevent="submit"
      >
        <div class="flex flex-col gap-2 rounded-xl border border-input bg-card/85 p-2 backdrop-blur-[6px] sm:flex-row sm:items-center sm:gap-2.5 sm:py-2 sm:pl-6 sm:pr-2">
          <input
            v-model="query"
            :placeholder="ask?.placeholder"
            :aria-label="ask?.inputLabel"
            class="min-w-0 flex-1 border-none bg-transparent px-4 py-3 text-lg text-text-strong outline-none placeholder:text-text-faint sm:px-0"
          >
          <button
            type="submit"
            class="btn-glass inline-flex w-full flex-shrink-0 items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-base font-medium text-foreground backdrop-blur-[10px] sm:w-auto"
          >
            {{ ask?.submit }} <span
              aria-hidden="true"
              class="text-base"
            >→</span>
          </button>
        </div>
      </form>

      <!-- Gentle nudge when Ask is pressed with an empty field -->
      <p
        v-if="askHint"
        class="mt-3 text-sm text-accent-warm"
      >
        {{ askHint }}
      </p>

      <!-- Relevance tolerance, set BEFORE asking. Binds to the same `threshold`
           the results view uses, so the first query already honours it. No cards
           to dim here yet, so a short hint explains what it does instead. -->
      <div class="mt-7 max-w-[680px]">
        <div class="flex items-center gap-3">
          <span class="whitespace-nowrap text-sm text-text-secondary">{{ answerCopy?.tolerance }}</span>
          <Slider
            v-model="thresholdModel"
            :min="0"
            :max="1"
            :step="0.01"
            :aria-label="answerCopy?.tolerance"
            class="max-w-[200px]"
          />
          <span class="w-9 font-mono text-xs tabular-nums text-text-secondary">{{ threshold.toFixed(2) }}</span>
          <InfoTooltip :text="answerCopy?.toleranceHint" />
        </div>
      </div>

      <!-- Toggle + examples in normal flow. The section is top-anchored (pt-[19vh]),
           so opening the list grows the page downward without shifting the content
           up (no jump), and the page scrolls when space runs out. -->
      <button
        type="button"
        class="mt-6 inline-flex w-fit items-center gap-1.5 text-sm text-text-faint transition-colors hover:text-text-secondary"
        :aria-expanded="showExamples"
        @click="showExamples = !showExamples"
      >
        {{ ask?.examplesToggle }}
        <ChevronDown
          class="size-4 transition-transform"
          :class="showExamples ? 'rotate-180' : ''"
        />
      </button>
      <div
        v-if="showExamples"
        class="mt-4 flex flex-wrap gap-2.5 animate-fade-up"
      >
        <button
          v-for="example in ask?.examples"
          :key="example"
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-white/11 bg-white/3 px-4 py-2.5 text-sm text-text-body transition-colors hover:border-white/[0.28] hover:text-foreground"
          @click="useExample(example)"
        >
          <span
            aria-hidden="true"
            class="text-xs text-accent-cyan/50"
          >✦</span>{{ example }}
        </button>
      </div>
    </section>

    <!-- ═══════════ LOADING, the orbit spinner ═══════════ -->
    <div
      v-else-if="status === 'loading'"
      class="animate-fade-up flex min-h-[calc(100dvh-3.25rem)] items-center justify-center px-5"
    >
      <OrbitLoader :label="ask?.loading" />
    </div>

    <!-- ═══════════ ANSWER, hero image + AI answer + sources ═══════════ -->
    <article
      v-else-if="status === 'answer'"
      class="pb-4 animate-fade-up"
    >
      <!-- Full-bleed hero of the current source (top match by default). Clicking
           a source card below swaps this image in with a slide. The text on top
           is held to the same content width as the header and footer. -->
      <figure class="relative m-0 h-[440px] overflow-hidden bg-space-deep md:h-[560px]">
        <div
          class="absolute inset-0"
          :style="{ background: cardGradient(heroIndex) }"
        />
        <Transition name="hero-swap">
          <!-- Direct NASA .mp4: native autoplay, muted, looping. -->
          <video
            v-if="isVideo(heroSource) && isFileVideo(heroSource?.imageUrl)"
            :key="heroIndex"
            :src="heroSource!.imageUrl"
            autoplay
            muted
            loop
            playsinline
            class="absolute inset-0 h-full w-full object-cover"
          />
          <!-- YouTube embed: autoplaying muted iframe. -->
          <iframe
            v-else-if="isVideo(heroSource)"
            :key="heroIndex"
            :src="youtubeAutoplaySrc(heroSource!.imageUrl)"
            title=""
            allow="autoplay; encrypted-media; picture-in-picture"
            class="absolute inset-0 h-full w-full"
          />
          <!-- Still image, optimized via @nuxt/image (AVIF/WebP + Netlify CDN).
               <picture> gets the absolute fill; the inner <img> gets the sizing. -->
          <NuxtPicture
            v-else-if="heroSource?.imageUrl"
            :key="heroIndex"
            :src="heroSource.imageUrl"
            :alt="heroSource.title"
            sizes="600px sm:960px md:1280px lg:1600px xl:1920px"
            class="absolute inset-0"
            :img-attrs="{ class: 'h-full w-full object-cover' }"
            @error="hideBrokenImage"
          />
        </Transition>
        <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,3,8,0.35)_0%,transparent_26%,rgba(2,3,8,0.55)_66%,#020308_100%)]" />

        <!-- Tolerance-empty mask: when the slider filters every source out, the
             hero image no longer reflects a real match, so cover it. -->
        <div
          v-if="allBelowThreshold"
          class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-space-deep/85 px-6 text-center backdrop-blur-[2px]"
        >
          <BlackHole
            variant="cool"
            :size="150"
          />
          <p class="max-w-[320px] text-sm text-text-secondary">
            {{ answerCopy?.toleranceEmpty }}
          </p>
        </div>

        <!-- New search, aligned to the content container -->
        <div class="absolute inset-x-0 top-[88px] z-20">
          <div class="container mx-auto px-5 md:px-8">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-2.5 text-sm text-foreground backdrop-blur-[10px] transition-colors hover:bg-black/60"
              @click="reset"
            >
              <span aria-hidden="true">←</span> {{ answerCopy?.newSearch }}
            </button>
          </div>
        </div>

        <!-- Caption, aligned to the content container -->
        <figcaption class="pointer-events-none absolute inset-x-0 bottom-6 md:bottom-9">
          <div class="container mx-auto px-5 md:px-8">
            <div class="mb-4 flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1.5 rounded-full border border-white/[0.16] bg-black/50 px-3 py-1.5 text-sm text-foreground">
                <span
                  aria-hidden="true"
                  class="size-1.5 rounded-full"
                  :class="heroIsTop ? 'bg-accent-green' : 'bg-accent-cyan'"
                />
                {{ heroIsTop ? answerCopy?.topMatch : answerCopy?.match }} · {{ heroSource?.score.toFixed(2) }}
              </span>
              <span class="inline-flex items-center rounded-full border border-white/[0.16] bg-black/50 px-3 py-1.5 font-mono text-xs text-text-body">
                {{ heroSource?.date }}
              </span>
            </div>
            <div class="mb-2.5 text-sm text-text-body">
              {{ heroIsTop ? answerCopy?.askedLabel : answerCopy?.sourceLabel }}
            </div>
            <h2
              ref="answerHeading"
              tabindex="-1"
              class="max-w-[760px] font-serif text-[clamp(28px,5vw,52px)] font-light leading-[1.04] tracking-[-0.01em] text-white focus:outline-none"
            >
              {{ heroIsTop ? queryEcho : heroSource?.title }}
            </h2>
          </div>
        </figcaption>
      </figure>

      <!-- Body: content width, matching the header/footer container -->
      <div class="container mx-auto px-5 md:px-8">
        <!-- The grounded AI answer, rendered from Markdown -->
        <section
          class="mx-auto max-w-[760px]"
          aria-labelledby="answer-heading"
        >
          <div class="mb-5 mt-2 flex items-center gap-3 md:mt-11">
            <span
              aria-hidden="true"
              class="h-0.5 w-6 rounded bg-gradient-accent"
            />
            <h3
              id="answer-heading"
              class="text-sm text-accent-purple"
            >
              {{ answerCopy?.heading }}
            </h3>
          </div>
          <!-- When the slider filters every source out, the earlier answer no
               longer applies, so show a tolerance-empty note in its place. -->
          <p
            v-if="allBelowThreshold"
            class="answer-prose text-text-secondary"
          >
            {{ answerCopy?.toleranceEmpty }}
          </p>
          <!-- Rendered from our own grounded LLM output, not user input. -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-else class="answer-prose" v-html="answerHtml" />
        </section>

        <!-- Sources -->
        <section
          class="mx-auto max-w-[760px]"
          aria-labelledby="sources-heading"
        >
          <Carousel
            class="relative"
            :opts="{ align: 'start' }"
            :plugins="autoplayPlugins"
            @init-api="onCarouselInit"
          >
            <div class="mb-5 mt-12 flex items-baseline justify-between">
              <div class="flex items-baseline gap-3">
                <h3
                  id="sources-heading"
                  class="font-serif text-2xl text-foreground"
                >
                  {{ answerCopy?.sourcesHeading }}
                </h3>
                <span class="text-sm text-text-faint">{{ sources.length }} {{ answerCopy?.sourcesCount }}</span>
              </div>
              <div class="flex gap-2.5">
                <button
                  type="button"
                  :aria-label="answerCopy?.prevSource"
                  :disabled="!canScrollPrev"
                  class="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-base text-text-strong transition-colors enabled:hover:border-white/30 disabled:cursor-default disabled:text-white/20 disabled:opacity-60"
                  @click="carouselApi?.scrollPrev()"
                >
                  <span aria-hidden="true">←</span>
                </button>
                <button
                  type="button"
                  :aria-label="answerCopy?.nextSource"
                  :disabled="!canScrollNext"
                  class="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-base text-text-strong transition-colors enabled:hover:border-white/30 disabled:cursor-default disabled:text-white/20 disabled:opacity-60"
                  @click="carouselApi?.scrollNext()"
                >
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>

            <!-- Relevance-tolerance slider: sets the cutoff a source's score must
                 clear. Dragging dims the weak cards live (free, client-only); "ask
                 again" re-runs the query with this cutoff. @keydown.stop keeps the
                 arrow keys driving the slider, not the carousel's arrow-key paging. -->
            <div
              class="mb-6 flex items-center gap-3"
              @keydown.stop
            >
              <span class="whitespace-nowrap text-sm text-text-secondary">{{ answerCopy?.tolerance }}</span>
              <Slider
                v-model="thresholdModel"
                :min="0"
                :max="1"
                :step="0.01"
                :aria-label="answerCopy?.tolerance"
                class="max-w-[200px]"
              />
              <span class="w-9 font-mono text-xs tabular-nums text-text-secondary">{{ threshold.toFixed(2) }}</span>
              <InfoTooltip :text="answerCopy?.toleranceHint" />
              <button
                v-if="thresholdChanged"
                type="button"
                class="ml-auto animate-fade-up whitespace-nowrap rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-1.5 text-xs text-text-strong transition-colors hover:border-accent-cyan/70"
                @click="submit"
              >
                {{ answerCopy?.askAgain }}
              </button>
            </div>

            <!-- Source carousel: every source except the one in the hero. Embla
                 handles scroll / drag / autoplay; clicking a card lifts it into the
                 hero (and the previous hero match drops back in here). -->
            <CarouselContent class="pt-1 pb-4">
              <CarouselItem
                v-for="item in sliderSources"
                :key="item.src.date + item.src.title"
                class="basis-auto"
              >
                <div
                  class="w-64 overflow-hidden rounded-xl border bg-card/70 transition duration-300 hover:bg-card"
                  :class="[
                    item.index === 0 ? 'border-accent-green/60' : 'border-transparent',
                    item.src.score < threshold ? 'opacity-40 saturate-50' : ''
                  ]"
                >
                  <!-- The card body promotes this source into the hero. The "View
                       original" link is a sibling below, not nested, so we never put
                       an <a> inside a <button> (invalid + breaks keyboard/AT). -->
                  <button
                    type="button"
                    :aria-label="heroCardLabel(item.src.title)"
                    class="block w-full cursor-pointer text-left"
                    @click="selectSource(item.index)"
                  >
                    <div
                      class="relative h-40 overflow-hidden"
                      :style="{ background: cardGradient(item.index) }"
                    >
                      <NuxtPicture
                        v-if="cardImage(item.src)"
                        :src="cardImage(item.src)!"
                        :alt="item.src.title"
                        sizes="256px"
                        class="absolute inset-0"
                        :img-attrs="{ class: 'h-full w-full object-cover', loading: 'lazy' }"
                        @error="hideBrokenImage"
                      />
                      <!-- Play badge marks a video source (mp4s often have no thumb). -->
                      <div
                        v-if="isVideo(item.src)"
                        class="absolute inset-0 grid place-items-center"
                      >
                        <span class="grid size-10 place-items-center rounded-full border border-white/25 bg-black/45 backdrop-blur-sm">
                          <Play class="size-4 fill-white text-white" />
                        </span>
                      </div>
                    </div>
                    <div class="px-4 pt-3.5">
                      <div class="font-mono text-xs text-text-faint">
                        {{ item.src.date }}
                      </div>
                      <div class="mt-1.5 font-serif text-base leading-tight text-foreground">
                        {{ item.src.title }}
                      </div>
                      <div class="mt-3 flex items-center gap-2">
                        <div class="h-0.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            class="h-full rounded-full bg-gradient-accent"
                            :style="{ width: `${Math.round(item.src.score * 100)}%` }"
                          />
                        </div>
                        <span class="font-mono text-xs text-text-secondary">{{ item.src.score.toFixed(2) }}</span>
                      </div>
                    </div>
                  </button>
                  <div class="px-4 pb-4 pt-2.5">
                    <a
                      :href="item.src.imageUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-block text-xs text-star-link hover:text-white"
                    >
                      {{ answerCopy?.viewOriginal }} <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </div>
              </CarouselItem>
            </CarouselContent>
          </Carousel>
        </section>
      </div>
    </article>

    <!-- ═══════════ EMPTY, nothing crossed the event horizon ═══════════ -->
    <section
      v-else-if="status === 'empty'"
      class="flex min-h-[calc(100dvh-3.25rem)] flex-col items-center justify-center px-5 py-24 text-center animate-fade-up"
    >
      <BlackHole
        variant="cool"
        :size="220"
      />
      <h2
        ref="emptyHeading"
        tabindex="-1"
        class="mt-8 font-serif text-[clamp(26px,4vw,36px)] font-light text-text-strong focus:outline-none"
      >
        {{ states?.emptyHeading }}
      </h2>
      <p class="mx-auto mt-3 max-w-[440px] text-base leading-relaxed text-text-muted">
        {{ emptyMessage }}
      </p>
      <button
        type="button"
        class="btn-glass mt-6 rounded-lg px-6 py-3.5 text-sm font-medium text-foreground backdrop-blur-[10px]"
        @click="reset"
      >
        {{ states?.retryOther }}
      </button>
    </section>

    <!-- ═══════════ ERROR, the signal fell into a black hole ═══════════ -->
    <section
      v-else-if="status === 'error'"
      class="flex min-h-[calc(100dvh-3.25rem)] flex-col items-center justify-center px-5 py-24 text-center animate-fade-up"
    >
      <BlackHole
        variant="warm"
        :size="200"
      />
      <h2
        ref="errorHeading"
        tabindex="-1"
        class="mt-6 font-serif text-[clamp(26px,4vw,36px)] font-light text-text-warm focus:outline-none"
      >
        {{ states?.errorHeading }}
      </h2>
      <!-- One concise reason (from describeError), so it's clear the request
           actually failed (vs. an empty result). We drop the generic "something
           went wrong" line above it, since it only doubled the message. -->
      <p
        v-if="errorDetail"
        class="mx-auto mt-6 max-w-[420px] rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-2.5 font-mono text-xs leading-relaxed text-destructive"
      >
        {{ errorDetail }}
      </p>
      <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          class="btn-glass rounded-lg px-6 py-3.5 text-sm font-medium text-foreground backdrop-blur-[10px]"
          @click="submit"
        >
          {{ states?.retry }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-border px-6 py-3.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
          @click="reset"
        >
          {{ answerCopy?.newSearch }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Prose styling for the rendered Markdown answer. The first paragraph reads as
   a serif lead, like the design; the rest is calm body copy. */
.answer-prose :deep(p) {
  margin: 0 0 1rem;
  font-size: 16.5px;
  line-height: 1.75;
  color: var(--text-body);
}
.answer-prose :deep(p:first-child) {
  font-family: var(--serif);
  font-weight: 300;
  font-size: 25px;
  line-height: 1.5;
  color: #ececf0;
  margin-bottom: 1.25rem;
}
.answer-prose :deep(strong) {
  color: #dfe6f2;
  font-weight: 500;
}
.answer-prose :deep(em) {
  font-style: italic;
  color: #fff;
}
.answer-prose :deep(ul),
.answer-prose :deep(ol) {
  margin: 0 0 1rem;
  /* No left padding: Tailwind's preflight strips list markers, so the padding
     would only produce a stray indent that misaligns the list with the prose. */
  padding-left: 0;
  color: var(--text-body);
}
.answer-prose :deep(li) {
  margin-bottom: 0.4rem;
  line-height: 1.7;
}
.answer-prose :deep(a) {
  color: var(--star-link);
}
.answer-prose :deep(a:hover) {
  color: #fff;
}

/* Hero image swap: the newly clicked source slides up over the previous one. */
.hero-swap-enter-active,
.hero-swap-leave-active {
  transition: transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.5s ease;
}
.hero-swap-enter-from {
  transform: translateY(40%);
  opacity: 0;
}
.hero-swap-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .hero-swap-enter-active,
  .hero-swap-leave-active {
    transition: opacity 0.2s ease;
  }
  .hero-swap-enter-from {
    transform: none;
  }
}
</style>
