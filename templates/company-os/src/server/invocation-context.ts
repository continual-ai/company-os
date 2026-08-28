import type { ActorId, IdentityId } from "@company/model"
import {
  CurrentInvocation,
  type InvocationContext,
} from "@company/runtime/effect/object-service"
import { Data, Effect } from "effect"

import { ANONYMOUS_ACTOR_ID, SYSTEM_SERVICE_ACCOUNT_ID } from "@/system-records"

export class ReservedSystemActor extends Data.TaggedError(
  "ReservedSystemActor"
)<{ readonly actorId: IdentityId }> {}

/** Builds context after external credentials resolve to a local identity. */
export const authenticatedInvocation = Effect.fn(
  "@company/authenticatedInvocation"
)(function* (actorId: IdentityId, authorizationActorId: IdentityId = actorId) {
  if (
    actorId === SYSTEM_SERVICE_ACCOUNT_ID ||
    authorizationActorId === SYSTEM_SERVICE_ACCOUNT_ID
  ) {
    return yield* Effect.fail(
      new ReservedSystemActor({
        actorId:
          actorId === SYSTEM_SERVICE_ACCOUNT_ID
            ? actorId
            : authorizationActorId,
      })
    )
  }
  return { actorId, authorizationActorId } satisfies InvocationContext
})

/** Context reserved for trusted internal seeds, jobs, and workflows. */
export const systemInvocation = {
  actorId: SYSTEM_SERVICE_ACCOUNT_ID,
  authorizationActorId: SYSTEM_SERVICE_ACCOUNT_ID,
} satisfies InvocationContext

/** Context for operations deliberately exposed to callers without an identity. */
export const anonymousInvocation = {
  actorId: ANONYMOUS_ACTOR_ID,
  authorizationActorId: ANONYMOUS_ACTOR_ID,
} satisfies InvocationContext

/** Model-specific audit actor ID, narrowed at the trusted context boundary. */
export const currentActorId: Effect.Effect<ActorId, never, CurrentInvocation> =
  CurrentInvocation.pipe(
    Effect.map(({ actorId }) => {
      // SAFETY: every external invocation context is constructed in this module
      // after resolving the actor to an Actor implementation.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return actorId as ActorId
    })
  )

/** Model-specific actor whose business authority applies to this invocation. */
export const currentAuthorizationActorId: Effect.Effect<
  ActorId,
  never,
  CurrentInvocation
> = CurrentInvocation.pipe(
  Effect.map(({ authorizationActorId }) => {
    // SAFETY: every external invocation context is constructed in this module
    // after resolving the authorization subject to an Actor implementation.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return authorizationActorId as ActorId
  })
)
