import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Effect } from "effect"

import { seedAuthorization } from "#/modules/access/server/authorization-seed.ts"
import { bootstrapSystemActor } from "#/modules/access/server/bootstrap-system-actor.ts"
import { systemInvocation } from "#/server/invocation-context.ts"

/** Converges every required system record in dependency order. */
export const seedSystem = Effect.fn("@company/seedSystem")(function* () {
  yield* bootstrapSystemActor()
  yield* seedAuthorization().pipe(
    Effect.provideService(CurrentInvocation, systemInvocation)
  )
})
