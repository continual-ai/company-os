import type { IdentityId } from "@acme/api"
import {
  CurrentInvocation,
  type InvocationContext,
} from "@continual/runtime/effect/object-service"
import { Data, Effect } from "effect"

import { SYSTEM_SERVICE_ACCOUNT_ID } from "./authorization/well-known-authorization.server"

export class ReservedSystemActor extends Data.TaggedError(
  "ReservedSystemActor"
)<{ readonly actorId: IdentityId }> {}

/** Builds context after external credentials resolve to a local identity. */
export const authenticatedInvocation = Effect.fn(
  "@acme/authenticatedInvocation"
)(function* (actorId: IdentityId) {
  if (actorId === SYSTEM_SERVICE_ACCOUNT_ID) {
    return yield* Effect.fail(new ReservedSystemActor({ actorId }))
  }
  return { actorId } satisfies InvocationContext
})

/** Context reserved for trusted internal seeds, jobs, and workflows. */
export const systemInvocation = {
  actorId: SYSTEM_SERVICE_ACCOUNT_ID,
} satisfies InvocationContext

/** Acme's model-specific actor ID, narrowed at the trusted context boundary. */
export const currentActorId: Effect.Effect<
  IdentityId,
  never,
  CurrentInvocation
> = CurrentInvocation.pipe(
  Effect.map(({ actorId }) => {
    // SAFETY: every Acme invocation context is constructed in this module
    // after resolving the actor to an Identity implementation.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return actorId as IdentityId
  })
)
