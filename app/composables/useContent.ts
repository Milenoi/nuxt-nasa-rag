// UI copy from /api/content, split into the sections the Ask views consume. Every
// caller uses the same fetch key, so Nuxt dedupes to one request and shares the data.
export function useContent() {
  const { data: content } = useFetch('/api/content', { key: 'content' })
  return {
    content,
    hero: computed(() => content.value?.hero),
    ask: computed(() => content.value?.ask),
    answerCopy: computed(() => content.value?.answer),
    states: computed(() => content.value?.states),
    a11y: computed(() => content.value?.a11y),
    suggest: computed(() => content.value?.suggest),
    seo: computed(() => content.value?.seo)
  }
}
