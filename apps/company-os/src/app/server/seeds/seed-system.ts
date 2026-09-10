import { Effect } from "effect"

import { bootstrapSystemActor } from "#/runtime/access/server/bootstrap.ts"
import { seedIdentities } from "#/runtime/access/server/seed.ts"
import { seedModuleSettings } from "#/runtime/platform/server/index.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
export const seedSystem = Effect.fn("@company/seedSystem")(function* () {
  yield* bootstrapSystemActor()
  yield* seedIdentities().pipe(
    Effect.provideService(CurrentInvocation, systemInvocation)
  )
  yield* seedModuleSettings().pipe(
    Effect.provideService(CurrentInvocation, systemInvocation)
  )
})
