// The streamed NDJSON protocol for /api/ask, kept apart from the RAG steps
// (retrieveSources / streamAnswer, auto-imported from answerQuestion.ts): sources
// first, then the answer token by token, or an empty/offtopic marker. The
// NO_MATCH sentinel is held back until ruled out, so it never reaches the client.
export function askStream(question: string, threshold: number): ReadableStream {
    const encoder = new TextEncoder()
    const line = (obj: unknown) => encoder.encode(JSON.stringify(obj) + '\n')
    return new ReadableStream({
        async start(controller) {
            try {
                const { sources, strong, topScore } = await retrieveSources(question, threshold)
                controller.enqueue(line({ type: 'meta', question, threshold, sources, topScore }))
                if (strong.length === 0) {
                    controller.enqueue(line({ type: 'empty' }))
                    return controller.close()
                }
                let buffer = ''
                let decided = false
                for await (const text of streamAnswer(question, strong)) {
                    if (!decided) {
                        buffer += text
                        const seen = buffer.trimStart()
                        if (/^NO_MATCH/i.test(seen)) {
                            controller.enqueue(line({ type: 'offtopic' }))
                            return controller.close()
                        }
                        if (seen.length < 8) continue // not enough to rule out NO_MATCH yet
                        decided = true
                        controller.enqueue(line({ type: 'delta', text: buffer }))
                        buffer = ''
                        continue
                    }
                    controller.enqueue(line({ type: 'delta', text }))
                }
                if (buffer) controller.enqueue(line({ type: 'delta', text: buffer }))
                controller.enqueue(line({ type: 'done' }))
                controller.close()
            } catch (err) {
                controller.enqueue(line({ type: 'error', message: String((err as Error)?.message ?? err) }))
                controller.close()
            }
        }
    })
}
