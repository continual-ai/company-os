import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Effect } from "effect"

import { seedAuthorization } from "@/modules/access/server/authorization-seed"
import { bootstrapSystemActor } from "@/modules/access/server/bootstrap-system-actor"
import { systemInvocation } from "@/server/invocation-context"

/** Converges every required system record in dependency order. */
export const seedSystem = Effect.fn("@company/seedSystem")(function* () {
  yield* bootstrapSystemActor()
  yield* seedAuthorization().pipe(
    Effect.provideService(CurrentInvocation, systemInvocation)
  )
})
