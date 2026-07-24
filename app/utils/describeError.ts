// Turn a thrown fetch error into a short, readable reason. The Gemini quota
// (HTTP 429) is the common one on the free tier, so it's called out explicitly,
// preferring the structured status code, with a string check as a fallback.
export function describeError(err: unknown): string {
  const e = err as { statusCode?: number; statusMessage?: string; data?: unknown; message?: string }
  const raw = `${JSON.stringify(e?.data ?? '')} ${e?.message ?? ''}`
  if (e?.statusCode === 429 || raw.includes('429') || /quota|rate.?limit|exceeded/i.test(raw)) {
    return "Gemini's free-tier limit is reached. It resets on its own, try again in a bit."
  }
  if (e?.statusCode) {
    return `The answer service failed (HTTP ${e.statusCode}).`
  }
  return 'Could not reach the answer service. Check your connection.'
}
