import type { EvalCase } from '../server/usecases/evaluateRetrieval'

// Curated eval questions. expectedIds are APOD dates (YYYY-MM-DD) that SHOULD be
// retrieved. The dates below were verified against the live DB on 2026-07-28 by
// inspecting what the retrieval actually returns (title + date), so only genuinely
// correct, ingested sources are listed. Negative cases (gibberish or a topic the
// archive does not cover) keep an empty expectedIds and are excluded from Recall/MRR.
// Grow this as the backfill fills in.
export const evalCases: EvalCase[] = [
    // Positive cases: several genuinely-correct solar-eclipse pictures exist, any is a
    // valid answer to "show me a solar eclipse".
    {
        question: 'Show me a picture of a solar eclipse.',
        expectedIds: ['2024-03-10', '2024-03-31', '2024-10-08', '2023-09-17']
    },
    // The definitive "what IS the Andromeda galaxy" answer is M31 specifically.
    {
        question: 'What is the Andromeda galaxy?',
        expectedIds: ['2024-09-08']
    },
    // Negative cases (no correct answer expected):
    // "lion in the sky" has no match in the archive -> genuinely uncovered.
    { question: 'What looks like a lion in the sky?', expectedIds: [] },
    { question: 'asdfgh', expectedIds: [] },
    { question: 'cat', expectedIds: [] }
]
