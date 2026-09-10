import { Data, Effect } from "effect"

import type { IdentityId } from "#/runtime/access/model/ids.ts"
import type { ActorId } from "#/runtime/model/core/actor.ts"
import {
  ANONYMOUS_ACTOR_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
} from "#/runtime/model/system-records.ts"
import {
  CurrentInvocation,
  type InvocationContext,
} from "#/runtime/server/invocation.ts"

export class ReservedSystemActor extends Data.TaggedError(
  "ReservedSystemActor"
)<{ readonly actorId: IdentityId }> {}

/** Builds context after external credentials resolve to a local identity. */
export const authenticatedInvocation = Effect.fn(
  "@company/authenticatedInvocation"
)(function* (actorId: IdentityId) {
  if (actorId === SYSTEM_SERVICE_ACCOUNT_ID)
    return yield* Effect.fail(new ReservedSystemActor({ actorId }))
  return { actorId } satisfies InvocationContext
})

/** Context reserved for trusted internal seeds, jobs, and workflows. */
export const systemInvocation = {
  actorId: SYSTEM_SERVICE_ACCOUNT_ID,
} satisfies InvocationContext

/** Context for operations deliberately exposed to callers without an identity. */
export const anonymousInvocation = {
  actorId: ANONYMOUS_ACTOR_ID,
} satisfies InvocationContext

/** Actor attributed to writes in the current invocation. */
export const currentActorId: Effect.Effect<ActorId, never, CurrentInvocation> =
  CurrentInvocation.pipe(Effect.map(({ actorId }) => actorId))
