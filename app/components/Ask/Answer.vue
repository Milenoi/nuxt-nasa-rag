<script setup lang="ts">
import Autoplay from 'embla-carousel-autoplay'
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel'
import { Play } from '@lucide/vue'
import type { Source } from '~/types/ask'

const props = defineProps<{
  sources: Source[]
  heroIndex: number
  queryEcho: string
  noDirectAnswer: boolean
  remark: string
  answerHtml: string
}>()
const emit = defineEmits<{ reset: []; select: [index: number] }>()

const { answerCopy } = useContent()

const topMatch = computed(() => props.sources[0])
const heroSource = computed(() => props.sources[props.heroIndex] ?? topMatch.value)
const heroIsTop = computed(() => props.heroIndex === 0)

// Split the source explanation into paragraphs for a calmer read. Prefer real
// blank-line breaks; most NASA texts are a single blob, so fall back to grouping
// every few sentences into a paragraph instead of one wall of text.
const heroParagraphs = computed(() => {
  const text = heroSource.value?.explanation?.trim() ?? ''
  if (!text) return []
  const byBreaks = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (byBreaks.length > 1) return byBreaks
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z(])/)
  const perParagraph = 3
  const paragraphs: string[] = []
  for (let i = 0; i < sentences.length; i += perParagraph) {
    paragraphs.push(sentences.slice(i, i + perParagraph).join(' ').trim())
  }
  return paragraphs.filter(Boolean)
})

// aria-label for a source card, built from content ("Show {title} in the hero").
const heroCardLabel = (title: string) =>
  (answerCopy.value?.showInHero ?? '').replace('{title}', title)

// Move focus to the answer heading once it's on screen (the view mounts when the
// status switches to 'answer'), so the result isn't silent after the loader is gone.
const answerHeading = ref<HTMLElement | null>(null)
onMounted(() => answerHeading.value?.focus())

// Embla drives the source carousel (scroll / drag / autoplay). We hold its API so we
// can re-measure and jump back to the start after a hero swap changes the row.
const carouselApi = ref<CarouselApi>()
const canScrollPrev = ref(false)
const canScrollNext = ref(false)
// Autoplay pages the row gently. stopOnMouseEnter pauses it while the pointer is over
// the row; stopOnInteraction:false lets it resume; playOnInit:false lets us skip it
// entirely under prefers-reduced-motion.
const autoplayPlugins = [
  Autoplay({ delay: 4500, stopOnMouseEnter: true, stopOnInteraction: false, playOnInit: false })
]

// The carousel shows every source EXCEPT the one currently in the hero; clicking a
// card promotes it, and the previously featured match drops back into the row.
const carouselSources = computed(() =>
  props.sources
    .map((src, index) => ({ src, index }))
    .filter((item) => item.index !== props.heroIndex)
)

// Grab Embla's API on mount, track the scroll state for the arrows, and start
// autoplay unless the visitor asked for less motion.
function onCarouselInit(api: CarouselApi) {
  carouselApi.value = api
  const sync = () => {
    canScrollPrev.value = api?.canScrollPrev() ?? false
    canScrollNext.value = api?.canScrollNext() ?? false
  }
  api?.on('select', sync)
  api?.on('reInit', sync)
  sync()
  // Defer play() one frame so it lands after Autoplay's own init settles.
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduce) requestAnimationFrame(() => api?.plugins().autoplay?.play())
}

// Promoting a card into the hero changes which cards the row holds, so Embla has to
// re-measure and snap back to the first card.
watch(carouselSources, async () => {
  await nextTick()
  carouselApi.value?.reInit()
  carouselApi.value?.scrollTo(0, true)
})

// Clicking a source card lifts it into the hero (via the parent, which owns heroIndex
// + the URL) and scrolls back up so the swap is visible (honouring reduced-motion).
function onCardClick(index: number) {
  emit('select', index)
  if (import.meta.client) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }
}
</script>

<template>
  <article class="pb-4 animate-fade-up">
    <!-- Full-bleed hero of the current source (top match by default). Clicking a
         source card below swaps this image in with a slide. The text on top is held
         to the same content width as the header and footer. -->
    <figure class="relative m-0 h-110 overflow-hidden bg-space-deep md:h-140">
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

      <!-- New search, aligned to the content container -->
      <div class="absolute inset-x-0 top-22 z-20">
        <div class="container mx-auto px-5 md:px-8">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-2.5 text-sm text-foreground backdrop-blur-[10px] transition-colors hover:bg-black/60"
            @click="emit('reset')"
          >
            <span aria-hidden="true">←</span> {{ answerCopy?.newSearch }}
          </button>
        </div>
      </div>

      <!-- Caption, aligned to the content container -->
      <figcaption class="pointer-events-none absolute inset-x-0 bottom-6 md:bottom-9">
        <div class="container mx-auto px-5 md:px-8">
          <div class="mb-4 flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-full border border-white/16 bg-black/50 px-3 py-1.5 font-mono text-xs text-foreground">
              <span
                aria-hidden="true"
                class="size-1.5 rounded-full"
                :class="heroIsTop ? 'bg-accent-green' : 'bg-accent-cyan'"
              />
              {{ heroIsTop ? answerCopy?.topMatch : answerCopy?.match }} · {{ heroSource?.score.toFixed(2) }}
            </span>
            <span class="inline-flex items-center rounded-full border border-white/16 bg-black/50 px-3 py-1.5 font-mono text-xs text-text-body">
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
            {{ !heroIsTop ? answerCopy?.aboutHeading : (noDirectAnswer ? answerCopy?.closestHeading : answerCopy?.heading) }}
          </h3>
        </div>
        <!-- Clicked a non-top source: show that picture's own APOD description, since
             the grounded answer only covers the question / top match. -->
        <div v-if="!heroIsTop">
          <p
            v-for="(para, i) in heroParagraphs"
            :key="i"
            class="mb-4 text-base leading-relaxed text-text-body"
          >
            {{ para }}
          </p>
          <p class="mt-5 text-xs italic text-text-faint">
            {{ answerCopy?.aboutNote }}
          </p>
        </div>
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

          <!-- Source carousel: every source except the one in the hero. Embla handles
               scroll / drag / autoplay; clicking a card lifts it into the hero (and
               the previous hero match drops back in here). -->
          <CarouselContent class="pt-1 pb-4">
            <CarouselItem
              v-for="item in carouselSources"
              :key="`${item.src.date}|${item.src.title}`"
              class="basis-auto"
            >
              <div
                class="w-64 overflow-hidden rounded-xl border bg-card/70 transition duration-300 hover:bg-card"
                :class="item.index === 0 ? 'border-accent-green/60' : 'border-transparent'"
              >
                <!-- The card body promotes this source into the hero. The "View
                     original" link is a sibling below, not nested, so we never put an
                     <a> inside a <button> (invalid + breaks keyboard/AT). -->
                <button
                  type="button"
                  :aria-label="heroCardLabel(item.src.title)"
                  class="block w-full cursor-pointer text-left"
                  @click="onCardClick(item.index)"
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
</template>

<style scoped>
/* Prose styling for the rendered Markdown answer. The first paragraph reads as a
   serif lead, like the design; the rest is calm body copy. */
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
  color: var(--prose-lead);
  margin-bottom: 1.25rem;
}
.answer-prose :deep(strong) {
  color: var(--prose-strong);
  font-weight: 500;
}
.answer-prose :deep(em) {
  font-style: italic;
  color: var(--prose-em);
}
.answer-prose :deep(ul),
.answer-prose :deep(ol) {
  margin: 0 0 1rem;
  /* No left padding: Tailwind's preflight strips list markers, so the padding would
     only produce a stray indent that misaligns the list with the prose. */
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
  color: var(--prose-em);
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
