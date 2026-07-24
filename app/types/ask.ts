// Types for the Ask page.

// A retrieved APOD source from /api/ask.
export type Source = {
  date: string
  title: string
  imageUrl: string
  explanation: string
  score: number
  mediaType?: 'image' | 'video'
  thumbnailUrl?: string
}

// The /api/ask response.
export type AskResponse = {
  question: string
  answer: string
  sources: Source[]
  topScore?: number
  threshold?: number
}
