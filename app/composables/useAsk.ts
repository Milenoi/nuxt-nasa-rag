import { marked } from 'marked'
import type { Source, AskResponse } from '#shared/contracts/ask'

// All Ask-page interaction: the fetch to /api/ask (+ optional /api/suggest), the
// state machine, race-guard, URL sync and toggles. Called ONCE from index.vue. The
// answer/sources are local (gone on navigate-away); only status/timing are shared.
export function useAsk() {
  const { status, timing } = useAskStatus()
  const { ask, a11y } = useContent()
  const route = useRoute()
  const router = useRouter()

  const query = ref('')
  const queryEcho = ref('')
  const answer = ref('')
  const answerHtml = ref('')
  const sources = ref<Source[]>([])
  const errorDetail = ref('')
  const askHint = ref('')
  // sources matched but no grounded answer -> "closest matches" note
  const noDirectAnswer = ref(false)
  const remark = ref('')
  // mode the result was fetched with, so the empty-screen tone doesn't flip live
  const lastStarTrek = ref(false)
  const starTrek = ref(false) // ?st= + localStorage
  const rewrite = ref(false) // ?rw= + localStorage
  const suggesting = ref(false)
  const suggestions = ref<string[]>([])
  const heroIndex = ref(0) // 0 = top match
  const liveMessage = ref('') // SR announcement (views move focus themselves)

  const showIdle = computed(
    () => status.value === 'idle' && !suggesting.value && suggestions.value.length === 0
  )

  // Sanitize our grounded markdown before injecting it; DOMPurify is client-only.
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
      answerHtml.value = ''
    }
  })

  // Only the newest request may write; disposed blocks a late write after unmount.
  let requestId = 0
  let disposed = false

  function linkQuery(q: string, hero: number): Record<string, string> {
    return shareQuery({ q, hero, starTrek: starTrek.value, rewrite: rewrite.value })
  }

  async function runSearch(rawQuery: string) {
    const q = rawQuery.trim()
    if (!q) {
      askHint.value = ask.value?.emptyHint ?? 'Please ask something first.'
      return
    }
    query.value = q
    suggestions.value = []
    askHint.value = ''
    router.replace({ query: linkQuery(q, 0) }) // shareable URL (hero resets to 0)
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
      if (data.state === 'invalidInput') {
        sources.value = []
        status.value = 'empty'
        liveMessage.value = a11y.value?.noResults ?? ''
      } else {
        // answered / outOfScope both show hero + sources; outOfScope swaps the AI
        // text for a "closest matches" note.
        sources.value = data.sources ?? []
        answer.value = data.answer
        noDirectAnswer.value = data.state === 'outOfScope'
        status.value = 'answer'
        liveMessage.value = a11y.value?.answerReady ?? ''
      }
    } catch (err) {
      if (id !== requestId || disposed) return
      timing.value = null
      errorDetail.value = describeError(err)
      status.value = 'error'
      liveMessage.value = a11y.value?.requestError ?? ''
    }
  }

  // Smart search off: search straight away. On: fetch alternatives first, show them
  // if any, else just search.
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
        runSearch(q)
      }
    } catch {
      // Suggestion step failed (e.g. quota): fall back to a normal search.
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

  // heroIndex + URL only; the visual scroll lives in the Answer view.
  function selectSource(index: number) {
    heroIndex.value = index
    const q = typeof route.query.q === 'string' ? route.query.q : ''
    router.replace({ query: linkQuery(q, index) })
  }

  // The logo resets the shared status to 'idle' from anywhere; clear our state too.
  watch(status, (value) => {
    if (value === 'idle') {
      clearLocal()
      if (route.query.q) router.replace({ query: {} })
    }
  })

  // Browser back/forward or an edited URL. Watch ONLY q; our own toggle/hero replaces
  // never touch q. An equal (trimmed) value was our own submit, so we ignore it.
  watch(
    () => route.query.q,
    (raw) => {
      const q = typeof raw === 'string' ? raw : ''
      if (q === query.value.trim()) return
      if (q.trim()) {
        runSearch(q)
      } else {
        reset()
      }
    }
  )

  onUnmounted(() => {
    disposed = true
  })

  // Remember both toggles; keep them in the URL while a result is on screen.
  watch([starTrek, rewrite], () => {
    if (import.meta.client) {
      localStorage.setItem('apod-startrek', starTrek.value ? '1' : '0')
      localStorage.setItem('apod-rewrite', rewrite.value ? '1' : '0')
    }
    const q = typeof route.query.q === 'string' ? route.query.q : ''
    if (q) router.replace({ query: linkQuery(q, heroIndex.value) })
  })

  // status outlives this page but answer/sources are local, so a stale status would
  // render an empty view. Always start clean; a ?q= deep link re-runs the search.
  onMounted(async () => {
    const shared = route.query.q
    const heroParam = route.query.hero
    // Restore toggles: URL param wins (shared link), else localStorage.
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
        router.replace({ query: linkQuery(shared, h) })
      }
    } else if (status.value !== 'idle') {
      reset()
    }
  })

  // Typing dismisses the empty-field nudge.
  watch(query, () => {
    if (askHint.value) askHint.value = ''
  })

  return {
    query,
    queryEcho,
    answerHtml,
    sources,
    errorDetail,
    askHint,
    noDirectAnswer,
    remark,
    lastStarTrek,
    starTrek,
    rewrite,
    suggesting,
    suggestions,
    heroIndex,
    liveMessage,
    status,
    showIdle,
    runSearch,
    onAsk,
    chooseSuggestion,
    keepOriginal,
    useExample,
    reset,
    selectSource
  }
}
