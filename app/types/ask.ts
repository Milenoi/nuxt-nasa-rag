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

// What the backend decided about the question:
//   answered     - a grounded answer drawn from the sources
//   outOfScope   - a real question the archive doesn't cover; closest matches shown anyway
//   invalidInput - unusable input (gibberish, or nothing comes close); no answer attempted
export type AskState = 'answered' | 'outOfScope' | 'invalidInput'

// The /api/ask response.
export type AskResponse = {
  question: string
  answer: string
  sources: Source[]
  topScore: number
  state: AskState
  // Gemini's own one-liner for the nonsense / noAnswer states, in the question's
  // language (cheeky or encouraging). Empty when it didn't supply one.
  remark?: string
}
