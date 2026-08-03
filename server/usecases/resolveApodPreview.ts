import type { ApodCatalog } from './ports/repositories'
import { isReusableAsPreview } from '../domain/apod'

interface Deps {
    catalog: ApodCatalog
}

export interface ApodPreview {
    url: string
    date: string
    title: string
}

// Wide on purpose. APOD is mostly work by photographers, which we may not reuse:
// measured over 2026-07-20..08-03, only 2 of 15 days were NASA-owned stills. A short
// window would regularly find nothing at all. One request either way.
const LOOKBACK_DAYS = 45

// The newest APOD still image that NASA owns, for use as the site's social preview.
// `today` is a parameter, not read from the clock, so the caller decides and tests
// stay deterministic. Returns null when the whole window is videos or copyrighted
// work, which the caller treats as "no preview image" rather than an error.
export async function resolveApodPreview(today: string, deps: Deps): Promise<ApodPreview | null> {
    const start = new Date(today)
    start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS)
    const startIso = start.toISOString().slice(0, 10)

    const entries = await deps.catalog.fetchRange(startIso, today)
    const newestFirst = entries
        .filter(isReusableAsPreview)
        .sort((a, b) => b.date.localeCompare(a.date))

    const pick = newestFirst[0]
    return pick ? { url: pick.url, date: pick.date, title: pick.title } : null
}
