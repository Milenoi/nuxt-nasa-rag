// A readable reason for a failed /api/ask request. 429 (Gemini's free-tier
// quota) is the common one, so it gets its own message.
export function describeError(err: unknown): string {
  const e = err as { statusCode?: number; data?: unknown; message?: string }
  const raw = `${JSON.stringify(e?.data ?? '')} ${e?.message ?? ''}`
  if (e?.statusCode === 429 || raw.includes('429') || /quota|rate.?limit|exceeded/i.test(raw)) {
    return "Gemini's free-tier limit is reached. It resets on its own, try again in a bit."
  }
  if (e?.statusCode) {
    return `The answer service failed (HTTP ${e.statusCode}).`
  }
  return 'Could not reach the answer service. Check your connection.'
}
