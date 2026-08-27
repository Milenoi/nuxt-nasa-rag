// A readable reason for a failed /api/ask request. The two upstream states the
// user can act on get their own wording: 429 (Gemini's free-tier quota, gone for
// the day) and 503 (the model is momentarily oversubscribed, worth retrying now).
export function describeError(err: unknown): string {
  const e = err as { statusCode?: number; data?: unknown; message?: string }
  const raw = `${JSON.stringify(e?.data ?? '')} ${e?.message ?? ''}`
  if (e?.statusCode === 429 || /\b429\b/.test(raw) || /quota|rate.?limit|exceeded/i.test(raw)) {
    return "Gemini's free-tier limit is reached. It resets on its own, try again in a bit."
  }
  if (e?.statusCode === 503 || /\b503\b/.test(raw)) {
    return 'Gemini is busy right now. That is usually over in a moment, try again.'
  }
  if (e?.statusCode) {
    return `The answer service failed (HTTP ${e.statusCode}).`
  }
  return 'Could not reach the answer service. Check your connection.'
}
