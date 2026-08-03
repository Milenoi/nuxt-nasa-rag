import { loadNasaConfig, loadRagConfig } from '../infrastructure/config'
import { resolveSharePreview } from '../usecases/resolveSharePreview'
import { geminiEmbedder } from '../infrastructure/geminiEmbedder'
import { upstashVectorStore } from '../infrastructure/upstashVectorStore'
import { nasaApodCatalog } from '../infrastructure/nasaApodCatalog'

// Thin controller / composition root for a shared result link's preview image.
// Cached per question, because crawlers refetch the same URL repeatedly and each miss
// costs one embedding call.
export default defineCachedEventHandler(
    async (event): Promise<{ url: string; date: string; title: string } | null> => {
        const question = getQuery(event).q
        if (typeof question !== 'string' || !question.trim()) return null
        try {
            const rag = loadRagConfig()
            const nasa = loadNasaConfig()
            return await resolveSharePreview(question, {
                embedder: geminiEmbedder(rag.geminiApiKey),
                vectorStore: upstashVectorStore(rag.upstashUrl, rag.upstashToken),
                catalog: nasaApodCatalog(nasa.apiKey, nasa.apodUrl)
            })
        } catch (err) {
            // Never toHttpError: a missing preview must not break the shared page.
            console.error('[share-preview] falling back to the default preview:', err)
            return null
        }
    },
    {
        maxAge: 60 * 60 * 24,
        name: 'share-preview',
        getKey: (event) => String(getQuery(event).q ?? '').trim().toLowerCase().slice(0, 200)
    }
)
