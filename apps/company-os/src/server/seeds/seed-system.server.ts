import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Effect } from "effect"

import { systemInvocation } from "@/server/invocation-context.server"

import { seedAuthorization } from "./authorization.server"
import { bootstrapSystemActor } from "./bootstrap-system-actor.server"

/** Converges every source-owned system record in dependency order. */
export const seedSystem = Effect.fn("@company/seedSystem")(function* () {
  yield* bootstrapSystemActor()
  yield* seedAuthorization().pipe(
    Effect.provideService(CurrentInvocation, systemInvocation)
  )
})
