// Shapes shared across the Ask page, its composable, and its components.

// One retrieved APOD source, as the /api/ask route returns it.
export type Source = {
  date: string
  title: string
  imageUrl: string
  explanation: string
  score: number
  mediaType?: 'image' | 'video'
  thumbnailUrl?: string
}

// The full /api/ask response.
export type AskResponse = {
  question: string
  answer: string
  sources: Source[]
  topScore?: number
  threshold?: number
}
