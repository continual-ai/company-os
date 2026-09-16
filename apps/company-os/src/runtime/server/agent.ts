import { Context, Data, type Effect, type Schema } from "effect"

export interface AgentRunOptions {
  readonly input: string
  /** Best-effort provider deduplication hint. Codex ignores it. */
  readonly idempotencyKey?: string
}

export class AgentError extends Data.TaggedError("AgentError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** Execution identity is private; the URL is the user-facing session reference. */
export interface AgentSessionReference {
  readonly id: string
  readonly url: string | null
}

/** The host owns persistence and serializes runs within this session. */
export class AgentSession extends Context.Service<
  AgentSession,
  {
    readonly current: Effect.Effect<
      AgentSessionReference | undefined,
      AgentError
    >
    readonly save: (
      session: AgentSessionReference
    ) => Effect.Effect<void, AgentError>
  }
>()("@company/AgentSession") {}

/** One configured agent; each reconciliation supplies its own persistent session. */
export class Agent extends Context.Service<
  Agent,
  {
    /** Await a complete turn. Interruption cannot roll back tools; retries may repeat work. */
    readonly run: {
      <A>(
        options: AgentRunOptions & {
          readonly outputSchema: Schema.Codec<A, unknown>
        }
      ): Effect.Effect<A, AgentError, AgentSession>
      (
        options: AgentRunOptions & { readonly outputSchema?: undefined }
      ): Effect.Effect<void, AgentError, AgentSession>
    }
  }
>()("@company/Agent") {}
