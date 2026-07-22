<script setup lang="ts">
// The Ask page: the RAG front end. A question goes to POST /api/ask, which
// embeds it, retrieves the closest APOD texts by cosine similarity, and has
// Gemini write a grounded answer. Five states drive the whole UI:
//   idle → loading → answer   (with sources)
//                  ↘ empty    (nothing above the relevance threshold)
//                  ↘ error    (request failed)
// The pipeline footer mirrors `status` via useAskStatus().
import { marked } from 'marked'

type Source = {
  date: string
  title: string
  imageUrl: string
  explanation: string
  score: number
}
type AskResponse = {
  question: string
  answer: string
  sources: Source[]
  topScore?: number
}

const { data: content } = await useFetch('/api/content', { key: 'content' })
const { status, timing } = useAskStatus()
const route = useRoute()
const router = useRouter()

useSeoMeta({
  title: 'APOD Ask — ask the stars',
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
const active = ref(0)
// A short, human-readable reason shown on the error screen so it's clear WHY
// the request failed (e.g. the Gemini quota) versus genuinely finding nothing.
const errorDetail = ref('')
// Gentle nudge when someone hits Ask with an empty field.
const askHint = ref('')
// Best similarity on an empty result — below the cutoff the query clearly has
// nothing to do with space, which earns a playful roast instead of the neutral
// "nothing found" copy.
const emptyScore = ref(1)
const NONSENSE_CUTOFF = 0.5
const isNonsense = computed(() => emptyScore.value < NONSENSE_CUTOFF)
const emptyMessage = computed(() =>
  isNonsense.value
    ? states.value?.nonsense ?? ''
    : `${states.value?.empty ?? ''} ${states.value?.emptyHintSuffix ?? ''}`.trim()
)
// Which source is shown big in the hero. 0 = the top match (the answer hero);
// clicking another source card swaps the hero to that picture.
const heroIndex = ref(0)

// Announced to assistive tech + used to move focus when a state change happens,
// so the result isn't silent once the loader is removed from the DOM.
const liveMessage = ref('')
const answerHeading = ref<HTMLElement | null>(null)
const emptyHeading = ref<HTMLElement | null>(null)
const errorHeading = ref<HTMLElement | null>(null)

// The Gemini answer is Markdown. `marked` does not strip raw HTML, so even though
// the text comes from our own grounded route we sanitize the rendered HTML before
// injecting it. DOMPurify loads on the client only — the 'answer' state is always
// reached via a client-side request — so it never enters the server bundle.
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
// allowed to write the result — a slower earlier response is discarded.
let requestId = 0

async function submit() {
  const q = query.value.trim()
  if (!q) {
    askHint.value = ask.value?.emptyHint ?? 'Please ask something first.'
    return
  }
  askHint.value = ''
  // Reflect the query in the URL so the result is shareable / bookmarkable.
  if (route.query.q !== q) router.replace({ query: { q } })
  const id = ++requestId
  status.value = 'loading'
  timing.value = null
  active.value = 0
  heroIndex.value = 0
  const started = performance.now()
  try {
    const res = await $fetch<AskResponse>('/api/ask', {
      method: 'POST',
      body: { question: q }
    })
    if (id !== requestId) return
    timing.value = `${((performance.now() - started) / 1000).toFixed(2)} s`
    queryEcho.value = res.question
    if (!res.sources?.length) {
      answer.value = ''
      sources.value = []
      emptyScore.value = res.topScore ?? 1
      status.value = 'empty'
      announce(a11y.value?.noResults ?? '', emptyHeading)
    } else {
      answer.value = res.answer
      sources.value = res.sources
      status.value = 'answer'
      announce(a11y.value?.answerReady ?? '', answerHeading)
    }
  } catch (err) {
    if (id !== requestId) return
    timing.value = null
    errorDetail.value = describeError(err)
    status.value = 'error'
    announce(a11y.value?.requestError ?? '', errorHeading)
  }
}

// Turn a thrown fetch error into a short, readable reason. The Gemini quota
// (HTTP 429) is the common one on the free tier, so it's called out explicitly —
// preferring the structured status code, with a string check as a fallback.
function describeError(err: unknown): string {
  const e = err as { statusCode?: number; statusMessage?: string; data?: unknown; message?: string }
  const raw = `${JSON.stringify(e?.data ?? '')} ${e?.message ?? ''}`
  if (e?.statusCode === 429 || raw.includes('429') || /quota|rate.?limit|exceeded/i.test(raw)) {
    return 'Gemini rate limit reached (HTTP 429). The free-tier quota is used up — it resets automatically (per-minute limits within a minute, the daily quota at midnight Pacific time).'
  }
  if (e?.statusCode) {
    return `The answer service returned an error (HTTP ${e.statusCode}${e.statusMessage ? ` ${e.statusMessage}` : ''}).`
  }
  return 'Could not reach the answer service. Check your connection and try again.'
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
  active.value = 0
  heroIndex.value = 0
  errorDetail.value = ''
  emptyScore.value = 1
  liveMessage.value = ''
}

function reset() {
  clearLocal()
  timing.value = null
  status.value = 'idle'
}

// The logo (in the header) resets the shared status to 'idle' from anywhere —
// mirror that here by clearing the page's own state when it happens.
watch(status, (value) => {
  if (value === 'idle') {
    clearLocal()
    // Drop the ?q= param so a reset also gives a clean, shareable idle URL.
    if (route.query.q) router.replace({ query: {} })
  }
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
  if (typeof shared === 'string' && shared.trim()) {
    query.value = shared
    await submit()
    const h = Number(heroParam)
    if (Number.isInteger(h) && h > 0 && h < sources.value.length) {
      heroIndex.value = h
      router.replace({ query: { q: shared, hero: String(h) } })
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

// Shift the track by one card (width + gap) per step. Card is w-64 (256px) + gap-4 (16px).
const CARD_STEP = 256 + 16
function prevSource() {
  active.value = Math.max(0, active.value - 1)
}
function nextSource() {
  active.value = Math.min(sliderSources.value.length - 1, active.value + 1)
}

// Clicking a source card lifts it into the hero, resets the row to the start, and
// scrolls back up so the swap is visible (honouring reduced-motion).
function selectSource(index: number) {
  heroIndex.value = index
  active.value = 0
  // Reflect the featured source in the URL (omit for the top match / index 0).
  const nextQuery: Record<string, string> = {}
  if (typeof route.query.q === 'string') nextQuery.q = route.query.q
  if (index !== 0) nextQuery.hero = String(index)
  router.replace({ query: nextQuery })
  if (import.meta.client) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }
}

// A colourful gradient stands in behind each image (and shows through if the
// image fails to load), varied per card so the row never looks flat.
function cardGradient(i: number) {
  const h = (i * 47 + 200) % 360
  return `radial-gradient(120% 120% at 28% 18%, hsl(${h} 72% 56% / .5), transparent 46%), radial-gradient(90% 90% at 82% 84%, hsl(${(h + 45) % 360} 76% 46% / .42), transparent 52%), #04060b`
}

// Hide a broken image so the gradient placeholder underneath shows instead.
function hideBrokenImage(event: Event) {
  ;(event.target as HTMLElement).style.display = 'none'
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

    <!-- ═══════════ IDLE — the hero + ask box ═══════════ -->
    <section
      v-if="status === 'idle'"
      class="mx-auto max-w-[820px] px-5 pb-16 pt-[128px] animate-fade-up md:px-8"
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
        <div class="flex items-center gap-2.5 rounded-xl border border-input bg-card/85 py-2 pl-6 pr-2 backdrop-blur-[6px]">
          <input
            v-model="query"
            :placeholder="ask?.placeholder"
            :aria-label="ask?.inputLabel"
            class="min-w-0 flex-1 border-none bg-transparent py-3 text-lg text-text-strong outline-none placeholder:text-text-faint"
          >
          <button
            type="submit"
            class="btn-glass inline-flex flex-shrink-0 items-center gap-2 rounded-lg px-6 py-3.5 text-base font-medium text-foreground backdrop-blur-[10px]"
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

      <div class="mt-[18px] flex flex-wrap gap-2.5">
        <button
          v-for="example in ask?.examples"
          :key="example"
          type="button"
          class="inline-flex items-center gap-2 rounded-full border border-white/[0.11] bg-white/[0.03] px-4 py-2.5 text-sm text-text-body transition-colors hover:border-white/[0.28] hover:text-foreground"
          @click="useExample(example)"
        >
          <span
            aria-hidden="true"
            class="text-xs text-accent-cyan/50"
          >✦</span>{{ example }}
        </button>
      </div>
    </section>

    <!-- ═══════════ LOADING — the orbit spinner ═══════════ -->
    <div
      v-else-if="status === 'loading'"
      class="animate-fade-up flex min-h-dvh items-center justify-center px-5"
    >
      <OrbitLoader :label="ask?.loading" />
    </div>

    <!-- ═══════════ ANSWER — hero image + AI answer + sources ═══════════ -->
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
          <img
            v-if="heroSource?.imageUrl"
            :key="heroIndex"
            :src="heroSource.imageUrl"
            :alt="heroSource.title"
            class="absolute inset-0 h-full w-full object-cover"
            @error="hideBrokenImage"
          >
        </Transition>
        <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,3,8,0.35)_0%,transparent_26%,rgba(2,3,8,0.55)_66%,#020308_100%)]" />

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
        <figcaption class="pointer-events-none absolute inset-x-0 bottom-9">
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
          <div class="mb-5 mt-11 flex items-center gap-3">
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
          <!-- Rendered from our own grounded LLM output, not user input. -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="answer-prose" v-html="answerHtml" />
        </section>

        <!-- Sources -->
        <section
          class="mx-auto max-w-[760px]"
          aria-labelledby="sources-heading"
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
                :disabled="active === 0"
                class="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-base text-text-strong transition-colors enabled:hover:border-white/30 disabled:cursor-default disabled:text-white/20 disabled:opacity-60"
                @click="prevSource"
              >
                <span aria-hidden="true">←</span>
              </button>
              <button
                type="button"
                :aria-label="answerCopy?.nextSource"
                :disabled="active >= sliderSources.length - 1"
                class="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-base text-text-strong transition-colors enabled:hover:border-white/30 disabled:cursor-default disabled:text-white/20 disabled:opacity-60"
                @click="nextSource"
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <!-- Source carousel: every source except the one in the hero. Arrows page
               through; clicking a card lifts it into the hero (and the previous
               hero match drops back in here). -->
          <div class="overflow-hidden pb-4">
          <ul
            class="flex list-none gap-4 py-1 transition-transform duration-500 ease-out"
            :style="{ transform: `translateX(${-active * CARD_STEP}px)` }"
          >
            <li
              v-for="item in sliderSources"
              :key="item.src.date + item.src.title"
              class="w-64 flex-none overflow-hidden rounded-xl border bg-card/70 transition-colors hover:bg-card"
              :class="item.index === 0 ? 'border-accent-green/60' : 'border-transparent'"
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
                  <img
                    v-if="item.src.imageUrl"
                    :src="item.src.imageUrl"
                    :alt="item.src.title"
                    loading="lazy"
                    class="absolute inset-0 h-full w-full object-cover"
                    @error="hideBrokenImage"
                  >
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
            </li>
          </ul>
          </div>
        </section>
      </div>
    </article>

    <!-- ═══════════ EMPTY — nothing crossed the event horizon ═══════════ -->
    <section
      v-else-if="status === 'empty'"
      class="flex min-h-dvh flex-col items-center justify-center px-5 py-24 text-center animate-fade-up"
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

    <!-- ═══════════ ERROR — the signal fell into a black hole ═══════════ -->
    <section
      v-else-if="status === 'error'"
      class="flex min-h-dvh flex-col items-center justify-center px-5 py-24 text-center animate-fade-up"
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
      <p class="mx-auto mt-3 max-w-[430px] text-base leading-relaxed text-text-warm-muted">
        {{ states?.error }}
      </p>
      <!-- The concrete technical reason, so it's clear the API failed (vs. an
           empty result). -->
      <p
        v-if="errorDetail"
        class="mx-auto mt-4 max-w-[460px] rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-2.5 font-mono text-xs leading-relaxed text-destructive"
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
  padding-left: 1.25rem;
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
