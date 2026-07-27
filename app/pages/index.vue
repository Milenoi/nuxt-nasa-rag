<script setup lang="ts">
// The Ask page: the RAG front end. A question goes to POST /api/ask, which
// embeds it, retrieves the closest APOD texts by cosine similarity, and has
// Gemini write a grounded answer. Five states drive the whole UI:
//   idle → loading → answer   (with sources; may be a "closest matches" note)
//                  ↘ empty    (nothing in the archive comes close)
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
const suggest = computed(() => content.value?.suggest)

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
// True when sources matched but the model couldn't answer from them: the answer
// view then shows a "closest matches" note in place of the AI text.
const noDirectAnswer = ref(false)
// Gemini's own in-character one-liner for the nonsense / noAnswer states; shown in
// place of the static fallback copy when present.
const remark = ref('')
// The personality mode the current result was fetched with, so the fallback copy's
// tone doesn't flip if the toggle is changed while an empty screen is showing.
const lastStarTrek = ref(false)
// Star Trek personality toggle (idle screen). On: Gemini adds in-character remarks
// and a warm opener; off: cool, factual, straight from the sources. Synced to
// `?st=` (shareable) and remembered in localStorage.
const starTrek = ref(false)
// Smart-search toggle (idle screen): when on, the raw question goes to /api/suggest
// first and the user picks a cleaned-up version before the search runs. Synced to
// `?rw=` + localStorage. Default off.
const rewrite = ref(false)
// The "did you mean?" step, local to this view (the shared AskStatus stays 'idle'
// until a real search starts): `suggesting` while /api/suggest runs, then the
// returned alternatives to pick from.
const suggesting = ref(false)
const suggestions = ref<string[]>([])
const showIdle = computed(() => status.value === 'idle' && !suggesting.value && suggestions.value.length === 0)
// Which source is shown big in the hero. 0 = the top match (the answer hero);
// clicking another source card swaps the hero to that picture.
const heroIndex = ref(0)

// Relevance tolerance: the score below which a source is dimmed out. This is
// purely client-side polish on the results already returned; the backend decides
// relevance with its own fixed cutoff. The slider drives the live dimming and
// syncs to `?t=`, so there is nothing to re-fetch when it moves.
const DEFAULT_THRESHOLD = 0.55
const threshold = ref(DEFAULT_THRESHOLD)
// reka-ui's Slider supports multiple thumbs, so its v-model is an array.
const thresholdModel = computed({
  get: () => [threshold.value],
  set: (value: number[]) => { threshold.value = value[0] ?? DEFAULT_THRESHOLD }
})
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
  const html = marked.parse(md, { async: false })
  if (import.meta.client) {
    const { default: DOMPurify } = await import('dompurify')
    answerHtml.value = DOMPurify.sanitize(html)
  } else {
    // SSR: never inject unsanitized HTML. `answer` is only set client-side today;
    // if that ever changes, this stays safe (empty) rather than leaking markup.
    answerHtml.value = ''
  }
})

const topMatch = computed(() => sources.value[0])
const heroSource = computed(() => sources.value[heroIndex.value] ?? topMatch.value)
const heroIsTop = computed(() => heroIndex.value === 0)

// aria-label for a source card, built from content ("Show {title} in the hero").
const heroCardLabel = (title: string) =>
  (answerCopy.value?.showInHero ?? '').replace('{title}', title)

// Announce the new state and move focus to its heading, once the DOM has updated.
function announce(message: string, target: Ref<HTMLElement | null>) {
  liveMessage.value = message
  nextTick(() => target.value?.focus())
}

// A monotonic request id: if two requests are ever in flight, only the newest is
// allowed to write the result, a slower earlier response is discarded. `disposed`
// additionally blocks a late response from writing after the page was left, since
// status/timing live in useAskStatus (app-wide state that outlives this component).
let requestId = 0
let disposed = false

// Feed the page's reactive toggles into the pure shareQuery builder, so callers
// only pass what varies (question, hero, tolerance).
function linkQuery(q: string, hero: number, tol: number): Record<string, string> {
  return shareQuery({ q, hero, tolerance: tol, starTrek: starTrek.value, rewrite: rewrite.value })
}

async function runSearch(rawQuery: string) {
  const q = rawQuery.trim()
  if (!q) {
    askHint.value = ask.value?.emptyHint ?? 'Please ask something first.'
    return
  }
  // Keep the field and any open suggestion panel in sync with what we search.
  query.value = q
  suggestions.value = []
  askHint.value = ''
  // Reflect the query + tolerance in the URL so the result is shareable.
  // (heroIndex resets to 0 just below, so a fresh ask carries no hero param.)
  router.replace({ query: linkQuery(q, 0, threshold.value) })
  const id = ++requestId
  status.value = 'loading'
  timing.value = null
  heroIndex.value = 0
  answer.value = ''
  const started = performance.now()
  try {
    const data = await $fetch<AskResponse>('/api/ask', {
      method: 'POST',
      body: { question: q, starTrek: starTrek.value }
    })
    if (id !== requestId || disposed) return
    queryEcho.value = data.question || q
    timing.value = `${((performance.now() - started) / 1000).toFixed(2)} s`

    remark.value = data.remark ?? ''
    lastStarTrek.value = starTrek.value
    if (data.state === 'nonsense') {
      // Gibberish: the playful black-hole screen with Gemini's own quip.
      sources.value = []
      status.value = 'empty'
      announce(a11y.value?.noResults ?? '', emptyHeading)
    } else {
      // 'answer' or 'noAnswer' both show the hero + sources; noAnswer just swaps
      // the AI text for a "closest matches" note.
      sources.value = data.sources ?? []
      answer.value = data.answer
      noDirectAnswer.value = data.state === 'noAnswer'
      status.value = 'answer'
      announce(a11y.value?.answerReady ?? '', answerHeading)
    }
  } catch (err) {
    if (id !== requestId || disposed) return
    timing.value = null
    errorDetail.value = describeError(err)
    status.value = 'error'
    announce(a11y.value?.requestError ?? '', errorHeading)
  }
}

// The Ask button. Smart search off: search straight away. On: fetch cleaned-up
// alternatives first; show them if there are any, otherwise just search.
async function onAsk() {
  const q = query.value.trim()
  if (!q) {
    askHint.value = ask.value?.emptyHint ?? 'Please ask something first.'
    return
  }
  if (!rewrite.value) {
    runSearch(q)
    return
  }
  askHint.value = ''
  suggesting.value = true
  try {
    const data = await $fetch<{ suggestions: string[] }>('/api/suggest', {
      method: 'POST',
      body: { question: q }
    })
    suggesting.value = false
    if (data.suggestions?.length) {
      suggestions.value = data.suggestions
      liveMessage.value = a11y.value?.suggestionsReady ?? ''
    } else {
      // Nothing cleaner to offer, just search the original.
      runSearch(q)
    }
  } catch {
    // Suggestion step failed (e.g. quota): fall back to a normal search, which
    // surfaces the real error itself if /api/ask fails too.
    suggesting.value = false
    runSearch(q)
  }
}

function chooseSuggestion(q: string) {
  runSearch(q)
}

function keepOriginal() {
  runSearch(query.value)
}

// Examples are already clean questions, so they skip the suggestion step.
function useExample(example: string) {
  runSearch(example)
}

function clearLocal() {
  query.value = ''
  answer.value = ''
  sources.value = []
  queryEcho.value = ''
  heroIndex.value = 0
  errorDetail.value = ''
  noDirectAnswer.value = false
  remark.value = ''
  liveMessage.value = ''
  suggestions.value = []
  suggesting.value = false
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

// React to the browser's own navigation (back / forward, or an edited URL).
// onMounted only fires on the first mount, so without this a back after a search
// changes the URL but leaves the old result on screen. We watch ONLY `q`: our own
// replaces for the slider / toggles / hero change t/st/rw/hero, never q, so they
// don't retrigger this. An equal (trimmed) value means it was our own submit
// writing the URL, so we ignore it and never double-fetch.
watch(() => route.query.q, (raw) => {
  const q = typeof raw === 'string' ? raw : ''
  if (q === query.value.trim()) return
  if (q.trim()) {
    runSearch(q)
  } else {
    reset()
  }
})

// Keep the tolerance live in the URL as the slider moves (debounced, so it isn't
// replaced on every pixel). Carries the question + hero when there's a result.
let tUrlTimer: ReturnType<typeof setTimeout> | undefined
watch(threshold, (t) => {
  clearTimeout(tUrlTimer)
  tUrlTimer = setTimeout(() => {
    const q = typeof route.query.q === 'string' ? route.query.q : ''
    router.replace({ query: q ? linkQuery(q, heroIndex.value, t) : { t: t.toFixed(2) } })
  }, 250)
})

// On unmount: block any late response from writing shared state, and drop the
// pending tolerance-to-URL debounce so it can't fire against another route.
onUnmounted(() => {
  disposed = true
  clearTimeout(tUrlTimer)
})

// Remember both toggles, and when a result is on screen keep them in the shareable
// URL too.
watch([starTrek, rewrite], () => {
  if (import.meta.client) {
    localStorage.setItem('apod-startrek', starTrek.value ? '1' : '0')
    localStorage.setItem('apod-rewrite', rewrite.value ? '1' : '0')
  }
  const q = typeof route.query.q === 'string' ? route.query.q : ''
  if (q) router.replace({ query: linkQuery(q, heroIndex.value, threshold.value) })
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
  // Restore the toggles: URL param wins (shared link), else localStorage.
  const stParam = route.query.st
  if (stParam === '0' || stParam === '1') {
    starTrek.value = stParam === '1'
  } else if (import.meta.client) {
    const stored = localStorage.getItem('apod-startrek')
    if (stored === '0' || stored === '1') starTrek.value = stored === '1'
  }
  const rwParam = route.query.rw
  if (rwParam === '0' || rwParam === '1') {
    rewrite.value = rwParam === '1'
  } else if (import.meta.client) {
    const stored = localStorage.getItem('apod-rewrite')
    if (stored === '0' || stored === '1') rewrite.value = stored === '1'
  }
  if (typeof shared === 'string' && shared.trim()) {
    await runSearch(shared)
    const h = Number(heroParam)
    if (Number.isInteger(h) && h > 0 && h < sources.value.length) {
      heroIndex.value = h
      router.replace({ query: linkQuery(shared, h, threshold.value) })
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
  // Keep q + the current tolerance; add/drop hero.
  const q = typeof route.query.q === 'string' ? route.query.q : ''
  router.replace({ query: linkQuery(q, index, threshold.value) })
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
      v-if="showIdle"
      class="mx-auto flex min-h-[calc(100dvh-3.25rem)] max-w-[820px] flex-col px-5 pb-16 pt-28 animate-fade-up md:px-8 md:pt-[19vh]"
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
        @submit.prevent="onAsk"
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

      <!-- Two toggles, set BEFORE asking. Star Trek = answer tone; Smart search =
           rewrite the query before searching. Both only shape input/tone, not what
           counts as a match. flex-wrap keeps them on one line on phones and only
           wraps on very narrow screens. -->
      <div class="mt-7 flex max-w-[680px] flex-wrap items-center gap-x-5 gap-y-3">
        <div class="flex items-center gap-2">
          <PillToggle
            v-model="rewrite"
            :label="ask?.rewriteLabel"
          />
          <InfoTooltip :text="ask?.rewriteHint" />
        </div>
        <div class="flex items-center gap-2">
          <PillToggle
            v-model="starTrek"
            :label="ask?.personalityLabel"
            :label-short="ask?.personalityLabelShort"
          />
          <InfoTooltip :text="ask?.personalityHint" />
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

    <!-- ═══════════ SUGGESTING, Smart search fetching alternatives ═══════════ -->
    <div
      v-else-if="suggesting"
      class="animate-fade-up flex min-h-[calc(100dvh-3.25rem)] items-center justify-center px-5"
    >
      <OrbitLoader :label="suggest?.loading" />
    </div>

    <!-- ═══════════ SUGGESTIONS, the "did you mean?" panel ═══════════ -->
    <SuggestPanel
      v-else-if="suggestions.length"
      :question="query"
      :suggestions="suggestions"
      :copy="suggest"
      @choose="chooseSuggestion"
      @keep-original="keepOriginal"
    />

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
            :title="heroSource?.title ?? 'APOD video'"
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
        <div class="pointer-events-none absolute inset-0 bg-hero-scrim" />

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
              class="max-w-[760px] font-serif text-[clamp(28px,5vw,52px)] font-light leading-[1.04] tracking-[-0.01em] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50"
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
              {{ noDirectAnswer ? answerCopy?.closestHeading : answerCopy?.heading }}
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
          <!-- No grounded answer, but the sources are still the closest matches. -->
          <p
            v-else-if="noDirectAnswer"
            class="answer-prose text-text-secondary"
          >
            {{ remark || answerCopy?.noAnswerNote }}
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
            </div>

            <!-- Source carousel: every source except the one in the hero. Embla
                 handles scroll / drag / autoplay; clicking a card lifts it into the
                 hero (and the previous hero match drops back in here). -->
            <CarouselContent class="pt-1 pb-4">
              <CarouselItem
                v-for="item in sliderSources"
                :key="`${item.src.date}|${item.src.title}`"
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
        class="mt-8 font-serif text-[clamp(26px,4vw,36px)] font-light text-text-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50"
      >
        {{ states?.emptyHeading }}
      </h2>
      <p class="mx-auto mt-3 max-w-[440px] text-base leading-relaxed text-text-muted">
        {{ remark || (lastStarTrek ? states?.nonsense : states?.nonsensePlain) }}
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
        class="mt-6 font-serif text-[clamp(26px,4vw,36px)] font-light text-text-warm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50"
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
          @click="runSearch(query)"
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
