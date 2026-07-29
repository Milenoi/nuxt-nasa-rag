import { z } from 'zod'

export const askStateSchema = z.enum(['answered', 'outOfScope', 'invalidInput'])

export const retrievedSourceSchema = z.object({
    date: z.string(),
    title: z.string(),
    imageUrl: z.string(),
    explanation: z.string(),
    mediaType: z.string(),
    thumbnailUrl: z.string(),
    score: z.number()
})

// The domain result the use case returns.
export const askResultSchema = z.object({
    state: askStateSchema,
    sources: z.array(retrievedSourceSchema),
    topScore: z.number(),
    answer: z.string(),
    remark: z.string()
})

// The /api/ask wire response = the result plus the echoed question.
export const askResponseSchema = askResultSchema.extend({
    question: z.string()
})

export const suggestResponseSchema = z.object({
    suggestions: z.array(z.string())
})

export type AskState = z.infer<typeof askStateSchema>
export type RetrievedSource = z.infer<typeof retrievedSourceSchema>
export type AskResult = z.infer<typeof askResultSchema>
export type AskResponse = z.infer<typeof askResponseSchema>
export type SuggestResponse = z.infer<typeof suggestResponseSchema>
// Client-facing alias so existing app code keeps using `Source`.
export type Source = RetrievedSource
