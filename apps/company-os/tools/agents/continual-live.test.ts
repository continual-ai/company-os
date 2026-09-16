import { createContinualClient, z } from "@continual/sdk"
import { it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"

// Requires CONTINUAL_URL, CONTINUAL_PROJECT_ID and CONTINUAL_API_KEY.
it.live(
  "Continual persists a structured result for reattachment",
  () =>
    Effect.gen(function* () {
      const client = createContinualClient()
      const outputSchema = z.object({ answer: z.number() })
      let completed = false
      const run = yield* Effect.acquireRelease(
        Effect.promise(() =>
          client.agent.run({
            prompt:
              "Compute 6 * 7 and submit the answer as the structured result. Do not modify resources or call external tools.",
            outputSchema,
            title: "Company OS SDK smoke test",
          })
        ),
        (handle) =>
          Effect.promise(async () => {
            try {
              if (!completed) await handle.cancel()
            } finally {
              await handle.close()
            }
          })
      )
      const result = yield* Effect.promise((signal) => run.result({ signal }))
      completed = true
      expect(result.output.answer).toBe(42)
      const resumed = client.agent.getRun(run.id, {
        expectedSchema: outputSchema,
      })
      yield* Effect.addFinalizer(() => Effect.promise(() => resumed.close()))
      const saved = yield* Effect.promise((signal) =>
        resumed.result({ signal })
      )
      expect(saved.output).toEqual(result.output)
    }),
  120_000
)
