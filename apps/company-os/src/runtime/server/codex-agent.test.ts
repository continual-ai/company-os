import { it } from "@effect/vitest"
import { Codex, type ThreadEvent } from "@openai/codex-sdk"
import { Deferred, Effect, Fiber, Ref, Schema } from "effect"
import { expect, expectTypeOf, vi } from "vitest"

import {
  AgentError,
  AgentSession,
  type AgentSessionReference,
} from "#/runtime/server/agent.ts"
import { CodexAgent } from "#/runtime/server/codex-agent.ts"

const started: ThreadEvent = { type: "thread.started", thread_id: "thread-1" }
const completed: ThreadEvent = {
  type: "turn.completed",
  usage: {
    input_tokens: 1,
    cached_input_tokens: 0,
    cache_write_input_tokens: 0,
    output_tokens: 1,
    reasoning_output_tokens: 0,
  },
}
const message = (text: string): ThreadEvent => ({
  type: "item.completed",
  item: { type: "agent_message", id: "message-1", text },
})
async function* events(...items: ThreadEvent[]) {
  yield* items
}
const setup = Effect.gen(function* () {
  const reference = yield* Ref.make<AgentSessionReference | undefined>(
    undefined
  )
  const session = AgentSession.of({
    current: Ref.get(reference),
    save: (value) => Ref.set(reference, value),
  })
  const client = new Codex()
  const thread = client.startThread()
  const resume = vi.spyOn(client, "resumeThread").mockReturnValue(thread)
  vi.spyOn(client, "startThread").mockReturnValue(thread)
  const run = vi.spyOn(thread, "runStreamed").mockImplementation(async () => ({
    events: events(started, message('{"summary":"Done"}'), completed),
  }))
  return { session, client, resume, run, agent: CodexAgent.make(client) }
})

it.effect(
  "decodes output and lets the host persist and resume the session",
  () =>
    Effect.gen(function* () {
      const { agent, session, client, resume, run } = yield* setup
      const outputSchema = Schema.Struct({ summary: Schema.String })
      const result = yield* agent
        .run({ input: "Research", outputSchema })
        .pipe(Effect.provideService(AgentSession, session))
      expectTypeOf(result).toEqualTypeOf<{ readonly summary: string }>()
      expect(result.summary).toBe("Done")
      expect(yield* session.current).toEqual({
        id: "thread-1",
        url: null,
      })
      yield* CodexAgent.make(client)
        .run({ input: "Continue" })
        .pipe(Effect.provideService(AgentSession, session))
      expect(resume).toHaveBeenCalledWith("thread-1", undefined)
      expect(run.mock.calls[0]?.[1]?.outputSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
      })
    })
)

for (const [name, items] of [
  ["invalid JSON", [started, message("bad"), completed]],
  ["invalid output", [started, message('{"summary":false}'), completed]],
  ["missing output", [started, completed]],
  ["incomplete stream", [started]],
  [
    "provider failure",
    [started, { type: "turn.failed", error: { message: "Failed" } }],
  ],
  ["fatal stream error", [started, { type: "error", message: "Fatal" }]],
] satisfies Array<[string, ThreadEvent[]]>) {
  it.effect(`fails on ${name} while retaining the started session`, () =>
    Effect.gen(function* () {
      const { agent, session, run } = yield* setup
      run.mockResolvedValueOnce({ events: events(...items) })
      const error = yield* agent
        .run({
          input: "Research",
          outputSchema: Schema.Struct({ summary: Schema.String }),
        })
        .pipe(Effect.flip, Effect.provideService(AgentSession, session))
      expect(error).toBeInstanceOf(AgentError)
      expect((yield* session.current)?.id).toBe("thread-1")
    })
  )
}

it.effect("aborts and closes the SDK iterator on interruption", () =>
  Effect.gen(function* () {
    const { agent, session, run } = yield* setup
    const entered = yield* Deferred.make<void>()
    let closed = false
    let signal: AbortSignal | undefined
    run.mockImplementationOnce(async (_input, options) => {
      signal = options?.signal
      return {
        events: (async function* () {
          try {
            yield started
            await new Promise<void>((resolve) => {
              signal!.addEventListener("abort", () => resolve(), { once: true })
              Deferred.doneUnsafe(entered, Effect.void)
            })
          } finally {
            closed = true
          }
        })(),
      }
    })
    const fiber = yield* agent
      .run({ input: "Research" })
      .pipe(Effect.provideService(AgentSession, session), Effect.forkChild)
    yield* Deferred.await(entered)
    yield* Fiber.interrupt(fiber)
    expect(signal?.aborted).toBe(true)
    expect(closed).toBe(true)
  })
)

it.effect("stops the stream when the host cannot save the session", () =>
  Effect.gen(function* () {
    const { agent, session, run } = yield* setup
    let closed = false
    run.mockResolvedValueOnce({
      events: (async function* () {
        try {
          yield started
          yield completed
        } finally {
          closed = true
        }
      })(),
    })
    const error = yield* agent.run({ input: "Research" }).pipe(
      Effect.flip,
      Effect.provideService(AgentSession, {
        ...session,
        save: () =>
          Effect.fail(new AgentError({ message: "Storage unavailable" })),
      })
    )
    expect(error.message).toBe("Storage unavailable")
    expect(closed).toBe(true)
  })
)
