// Shared state for the RAG pipeline status, so the footer can mirror what the
// Ask page is doing (idle → loading → answer / empty / error), the same way
// the sibling site's footer reflects its cache-fetch state. The Ask page writes
// `status`/`timing`; the footer reads them.
export type AskStatus = 'idle' | 'loading' | 'answer' | 'empty' | 'error'

export function useAskStatus() {
  const status = useState<AskStatus>('ask-status', () => 'idle')
  // Human-readable timing of the last answer (e.g. "0.42 s"), or null when idle.
  const timing = useState<string | null>('ask-timing', () => null)
  // Bumped when the logo is clicked, a "go home" pulse the Taurus easter egg
  // listens to so its dragged stars snap back to their original places.
  const homeReset = useState<number>('home-reset', () => 0)
  return { status, timing, homeReset }
}
