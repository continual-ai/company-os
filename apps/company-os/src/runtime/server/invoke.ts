import { Context, Effect, Layer } from "effect"

import type { ModelOperation } from "#/runtime/contract/operations.ts"
import { withApiErrors } from "#/runtime/server/api-error.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import {
  CurrentInvocation,
  type InvocationContext,
} from "#/runtime/server/invocation.ts"
import { runOperation } from "#/runtime/server/operation-mode.ts"
import { CommittedChanges } from "#/runtime/server/storage/committed-changes.ts"
import { Database } from "#/runtime/server/storage/database.ts"

const make = Effect.gen(function* () {
  const database = yield* Database
  return {
    /** All callers share action atomicity and committed write metadata; business policy remains in the operation. */
    run: Effect.fn("@company/Operations.run")(function* <A, E>(
      invocation: InvocationContext,
      descriptor: ModelOperation,
      operation: Effect.Effect<A, E, CurrentInvocation>
    ) {
      const changes = new Set<string>()
      const run = requireProjectAccess.pipe(
        Effect.andThen(operation),
        Effect.provideService(CurrentInvocation, invocation)
      )
      const value = yield* runOperation(database, descriptor.kind, run).pipe(
        Effect.provideService(CommittedChanges, changes),
        (effect) => withApiErrors(effect, descriptor)
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
