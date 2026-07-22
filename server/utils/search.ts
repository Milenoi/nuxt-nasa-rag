// Cosine similarity for already-normalized vectors (length 1),
// which reduces to just the dot product: multiply each pair, sum them up.
export function cosineSimilarity(a: number[], b: number[]): number {
    let sum = 0
    for (let i = 0; i < a.length; i++) {
        sum += (a[i] ?? 0) * (b[i] ?? 0)
    }
    return sum
}
