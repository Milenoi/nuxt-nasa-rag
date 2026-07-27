// Everything the shareable URL needs to encode about a result.
export type ShareQueryInput = {
  q: string
  hero: number
  starTrek: boolean
  rewrite: boolean
}

// Build the shareable URL query. Both toggles are always included so the link is
// explicit; `hero` is omitted at 0 (the top match).
export function shareQuery({ q, hero, starTrek, rewrite }: ShareQueryInput): Record<string, string> {
  const query: Record<string, string> = {
    q,
    st: starTrek ? '1' : '0',
    rw: rewrite ? '1' : '0'
  }
  if (hero > 0) query.hero = String(hero)
  return query
}
