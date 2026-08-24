import { CurrentInvocation } from "@continual/runtime/effect/object-service"
import { Effect } from "effect"

import { systemInvocation } from "@/server/invocation-context.server"

import { seedAuthorization } from "./authorization.server"
import { bootstrapSystemActor } from "./bootstrap-system-actor.server"

/** Converges every source-owned Company OS record in dependency order. */
export const seedCompanyOs = Effect.fn("@acme/seedCompanyOs")(function* () {
  yield* bootstrapSystemActor()
  yield* seedAuthorization().pipe(
    Effect.provideService(CurrentInvocation, systemInvocation)
  )
})
