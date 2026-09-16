import { type Codex, type ThreadOptions } from "@openai/codex-sdk"
import { Effect, Layer, Schema } from "effect"
import { OpenAiStructuredOutput } from "effect/unstable/ai"

import {
  Agent,
  AgentError,
  AgentSession,
  type AgentRunOptions,
} from "#/runtime/server/agent.ts"

const failure = (cause: unknown) =>
  new AgentError({ message: "Codex agent run failed", cause })

const make = (client: Codex, threadOptions?: ThreadOptions) => {
  function run<A>(
    options: AgentRunOptions & {
      readonly outputSchema: Schema.Codec<A, unknown>
    }
  ): Effect.Effect<A, AgentError, AgentSession>
  function run(
    options: AgentRunOptions & { readonly outputSchema?: undefined }
  ): Effect.Effect<void, AgentError, AgentSession>
  function run<A>(
    request: AgentRunOptions & {
      readonly outputSchema?: Schema.Codec<A, unknown> | undefined
    }
  ): Effect.Effect<A | void, AgentError, AgentSession> {
    return Effect.scoped(
      Effect.gen(function* () {
        const session = yield* AgentSession
        const schema = request.outputSchema
        const output =
          schema === undefined
            ? undefined
            : yield* Effect.try({
                try: () => OpenAiStructuredOutput.toCodecOpenAI(schema),
                catch: failure,
              })
        const previous = yield* session.current
        const threadId = previous?.id
        const thread = yield* Effect.try({
          try: () =>
            threadId === undefined
              ? client.startThread(threadOptions)
              : client.resumeThread(threadId, threadOptions),
          catch: failure,
        })
        const response = yield* Effect.acquireUseRelease(
          Effect.tryPromise({
            try: async () => {
              const controller = new AbortController()
              const { events } = await thread.runStreamed(request.input, {
                signal: controller.signal,
                outputSchema: output?.jsonSchema,
              })
              return { controller, events }
            },
            catch: failure,
          }),
          ({ events }) =>
            Effect.gen(function* () {
              let completed = false
              let finalResponse = ""
              while (true) {
                const next = yield* Effect.tryPromise({
                  try: () => events.next(),
                  catch: failure,
                })
                if (next.done) break
                const event = next.value
                switch (event.type) {
                  case "thread.started":
                    // Persist before advancing the stream, including on later failure.
                    yield* session.save({
                      id: event.thread_id,
                      // Desktop can claim the writer lock when opening a thread.
                      url: null,
                    })
                    break
                  case "item.completed":
                    if (event.item.type === "agent_message")
                      finalResponse = event.item.text
                    break
                  case "turn.completed":
                    completed = true
                    break
                  case "turn.failed":
                    return yield* Effect.fail(failure(event.error))
                  case "error":
                    return yield* Effect.fail(failure(event.message))
                }
              }
              if (!completed)
                return yield* Effect.fail(
                  failure("Stream ended without turn completion")
                )
              return finalResponse
            }),
          ({ controller, events }) =>
            Effect.promise(async () => {
              controller.abort()
              await events.return(undefined)
            }).pipe(Effect.ignoreCause)
        )
        if (output === undefined) return undefined
        return yield* Schema.decodeUnknownEffect(
          Schema.fromJsonString(output.codec)
        )(response)
      })
    ).pipe(
      Effect.mapError((cause) =>
        cause instanceof AgentError ? cause : failure(cause)
      )
    )
  }

  return Agent.of({ run })
}

/** A thin adapter over an injected SDK client and native ThreadOptions. */
export const CodexAgent = {
  make,
  layer: (client: Codex, options?: ThreadOptions) =>
    Layer.succeed(Agent, make(client, options)),
}
