<script setup lang="ts">
// About: the learning motivation behind the project and the exact stack — which
// model, which free tier, which APIs. Mirrors the sibling site's about page.
const { data: content } = await useFetch('/api/content', { key: 'content' })
const about = computed(() => content.value?.about)
const sibling = computed(() => content.value?.sibling)
const githubUrl = computed(() => content.value?.header?.githubUrl)

useSeoMeta({
  title: 'About — APOD Ask',
  description:
    'A hands-on RAG learning project over NASA APOD: local Transformers.js embeddings, hand-written cosine search, and Google Gemini for grounded answers.'
})
</script>

<template>
  <section class="animate-fade-up mx-auto min-h-dvh max-w-3xl px-5 pb-40 pt-32 text-center md:px-8">
    <p class="mb-3 text-sm font-medium tracking-wide text-text-muted">
      {{ about?.tagline }}
    </p>
    <h1 class="mx-auto mb-6 max-w-[16ch] text-balance font-serif text-[clamp(38px,5.5vw,60px)] font-light leading-tight tracking-tight text-text-strong">
      {{ about?.heading }}
    </h1>

    <p class="mx-auto mb-5 max-w-[58ch] text-base leading-relaxed text-text-body">
      {{ about?.lead1 }}
    </p>
    <p class="mx-auto max-w-[58ch] text-[15px] leading-relaxed text-text-secondary">
      {{ about?.lead2 }}
    </p>

    <!-- Stack -->
    <div class="mb-1 mt-14 text-xs uppercase tracking-wider text-text-faint">
      {{ about?.techStackLabel }}
    </div>
    <dl class="mx-auto max-w-xl border-t border-border text-left">
      <div
        v-for="row in about?.techStack"
        :key="row.label"
        class="flex flex-col justify-between gap-1 border-b border-border py-4 sm:flex-row sm:items-center sm:gap-6"
      >
        <dt class="flex-none text-sm text-text-muted sm:w-32">{{ row.label }}</dt>
        <dd class="m-0 text-left text-sm text-text-strong sm:text-right">
          {{ row.value }}
        </dd>
      </div>
    </dl>

    <a
      :href="githubUrl"
      target="_blank"
      rel="noopener"
      class="mt-10 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-white/30 hover:bg-white/10"
    >
      {{ about?.cta }}
    </a>

    <aside class="mx-auto mt-10 max-w-[56ch]">
      <p class="text-sm leading-relaxed text-text-muted">
        {{ about?.creditText }}
        <a
          :href="sibling?.url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-star-link underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-white/50"
        >{{ sibling?.label }}</a>.
      </p>
    </aside>

    <p class="mx-auto mt-4 max-w-[58ch] text-sm leading-relaxed text-text-faint">
      {{ about?.builtBy }} {{ about?.creditSep }}
      <a
        :href="about?.viridisUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-star-link underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-white/50"
      >{{ about?.viridisLabel }}</a>
    </p>
  </section>
</template>
