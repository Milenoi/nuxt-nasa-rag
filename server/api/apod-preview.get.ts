import { loadNasaConfig } from '../infrastructure/config'
import { resolveApodPreview } from '../usecases/resolveApodPreview'
import { nasaApodCatalog } from '../infrastructure/nasaApodCatalog'

// Thin controller / composition root for the social preview image. Cached because
// every server-rendered page needs it for its og:image, and the answer only changes
// once a day, so an uncached handler would call NASA on every single page view.
export default defineCachedEventHandler(
    async (): Promise<{ url: string; date: string; title: string } | null> => {
        const today = new Date().toISOString().slice(0, 10)
        try {
            const config = loadNasaConfig()
            return await resolveApodPreview(today, {
                catalog: nasaApodCatalog(config.apiKey, config.apodUrl)
            })
        } catch (err) {
            // Deliberately not toHttpError: a missing preview image must never break a
            // page, so a NASA outage or an unset key degrades to no og:image.
            console.error('[apod-preview] falling back to no preview image:', err)
            return null
        }
    },
    { maxAge: 60 * 60 * 6, name: 'apod-preview', getKey: () => 'latest' }
)
