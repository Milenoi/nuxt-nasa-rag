// One entry in our vector store ("the shelf"): an APOD's metadata plus the
// meaning vector of its explanation text. Shared by the ingest script and the
// ask API so there is a single source of truth for this shape.
export type ApodRecord = {
  date: string
  title: string
  imageUrl: string
  explanation: string
  vector: number[]
}
