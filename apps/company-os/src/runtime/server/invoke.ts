import { Context, Effect, Layer } from "effect"

import type { ExecutableModelOperation } from "#/runtime/model/operations.ts"
import { withApiErrors } from "#/runtime/server/api-error.ts"
import { CommittedChanges } from "#/runtime/server/database/committed-changes.ts"
import { Database } from "#/runtime/server/database/database.ts"
import {
  CurrentInvocation,
  type InvocationContext,
} from "#/runtime/server/invocation.ts"

const make = Effect.gen(function* () {
  const database = yield* Database
  return {
    /** All callers share action atomicity and committed write metadata; business policy remains in the operation. */
    run: Effect.fn("@company/Operations.run")(function* <A, E>(
      invocation: InvocationContext,
      descriptor: ExecutableModelOperation,
      operation: Effect.Effect<A, E, CurrentInvocation>
    ) {
      const changes = new Set<string>()
      const run = operation.pipe(
        Effect.provideService(CurrentInvocation, invocation)
      )
      const value = yield* (
        descriptor.definition.kind === "action"
          ? database.transaction(() => run)
          : run
      ).pipe(Effect.provideService(CommittedChanges, changes), (effect) =>
        withApiErrors(effect, descriptor)
      )
      return { value, changes: [...changes].sort() }
    }),
  }
})

export class Operations extends Context.Service<Operations>()(
  "@company/runtime/Operations",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
