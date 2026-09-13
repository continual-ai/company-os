import { Effect } from "effect"

import { ANONYMOUS_ACTOR_ID } from "#/runtime/model/system-records.ts"
import { ProjectAccessRequired } from "#/runtime/server/errors.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"

/** Only the trusted identity provider may construct an admitted invocation. */
export const requireProjectAccess = Effect.gen(function* () {
  const { actorId } = yield* CurrentInvocation
  if (actorId === ANONYMOUS_ACTOR_ID)
    return yield* Effect.fail(new ProjectAccessRequired())
  return undefined
})
