import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'

// We cache the model here so it loads only ONCE, not on every call.
let extractor: FeatureExtractionPipeline | null = null

// Turn a piece of text into a normalized 384-dimension vector.
export async function embed(text: string): Promise<number[]> {
    // First call: load the model. Later calls: reuse the cached one.
    if (!extractor) {
        extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2')
    }

    // Embed the single text. { pooling: 'mean', normalize: true } gives onenormalized sentence vector.
    const tensor = await extractor(text, { pooling: 'mean', normalize: true })

    // .tolist() always returns an array OF vectors (one per input text).
    // We passed a single text, so our vector is the only entry, at [0].
    const vectors = tensor.tolist()

    return vectors[0]
}
