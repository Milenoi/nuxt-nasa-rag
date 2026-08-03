<script setup lang="ts">
// FAQ: the questions a first-time visitor is likely to have, in a shadcn accordion.
// Copy comes from /api/content (faq block); the same items also feed a FAQPage
// JSON-LD block (via nuxt-schema-org) so the answers are rich-result eligible.
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

const { data: content } = await useFetch('/api/content', { key: 'content' })
const faq = computed(() => content.value?.faq)

useSeoMeta({
  title: () => content.value?.seo?.faq?.title,
  description: () => content.value?.seo?.faq?.description,
  ogTitle: () => content.value?.seo?.faq?.title,
  ogDescription: () => content.value?.seo?.faq?.description
})

// Mark the page as a FAQPage and feed its questions from the same items rendered
// below, so there is no duplicate content to maintain.
useSchemaOrg([
  defineWebPage({
    '@type': ['WebPage', 'FAQPage'],
    mainEntity: (faq.value?.items ?? []).map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.link ? `${item.a} ${item.link.url}` : item.a }
    }))
  })
])
</script>

<template>
  <section class="animate-fade-up mx-auto min-h-dvh max-w-2xl px-5 pb-40 pt-32 md:px-8">
    <header class="text-left md:text-center">
      <p class="mb-3 text-sm font-medium tracking-wide text-text-muted">
        {{ faq?.tagline }}
      </p>
      <h1 class="mb-6 text-balance font-serif text-[clamp(34px,5vw,52px)] font-light leading-tight tracking-tight text-text-strong">
        {{ faq?.heading }}
      </h1>
      <p class="mx-auto mb-12 max-w-[52ch] text-base leading-relaxed text-text-body">
        {{ faq?.lead }}
      </p>
    </header>

    <Accordion
      type="single"
      collapsible
      class="w-full"
    >
      <AccordionItem
        v-for="(item, i) in faq?.items"
        :key="item.q"
        :value="`item-${i}`"
      >
        <AccordionTrigger class="py-5 text-left text-base text-text-strong hover:no-underline">
          {{ item.q }}
        </AccordionTrigger>
        <AccordionContent class="max-w-[62ch] text-[15px] leading-relaxed text-text-body">
          {{ item.a }}<span v-if="item.link">{{ ' ' }}<a
            :href="item.link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-star-link underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-white/50"
          >{{ item.link.label }}</a>.</span>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </section>
</template>
