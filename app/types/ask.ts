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
//   answer   - a grounded answer drawn from the sources
//   noAnswer - sources matched, but the model can't answer from them (show them anyway)
//   nonsense - nothing in the archive comes close; no answer attempted
export type AskState = 'answer' | 'noAnswer' | 'nonsense'

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
