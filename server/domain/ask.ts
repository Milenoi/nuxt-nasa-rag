// Domain entities for the ask flow. The shapes now live once in the shared Zod
// contract (`#shared/contracts/ask`), which is the single source of truth for
// client and server. This module re-exports them so the use cases and adapters
// keep importing from the domain layer, unaware of where the definition lives.
// Dependency rule is intact: the contract is framed as the core entities and
// everything still points inward to it.
export type { RetrievedSource, AskState, AskResult } from '#shared/contracts/ask'
