import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Effect } from "effect"

import { systemInvocation } from "@/server/invocation-context"
import { seedAuthorization } from "@/server/modules/access/authorization-seed"
import { bootstrapSystemActor } from "@/server/modules/access/bootstrap-system-actor"

/** Converges every required system record in dependency order. */
export const seedSystem = Effect.fn("@company/seedSystem")(function* () {
  yield* bootstrapSystemActor()
  yield* seedAuthorization().pipe(
    Effect.provideService(CurrentInvocation, systemInvocation)
  )
})
