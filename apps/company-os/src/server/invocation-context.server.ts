import type { ActorId } from "@continual/runtime"
import type { InvocationContext } from "@continual/runtime/effect/object-service"
import { Data, Effect } from "effect"

import {
  PLATFORM_ID,
  SYSTEM_ACTOR_ID,
} from "./authorization/well-known-authorization.server"

export class ReservedSystemActor extends Data.TaggedError(
  "ReservedSystemActor"
)<{ readonly actorId: ActorId }> {}

/** Builds context after external credentials resolve to a local identity. */
export const authenticatedInvocation = Effect.fn(
  "@acme/authenticatedInvocation"
)(function* (actorId: ActorId) {
  if (actorId === SYSTEM_ACTOR_ID) {
    return yield* Effect.fail(new ReservedSystemActor({ actorId }))
  }
  return { actorId, rootId: PLATFORM_ID } satisfies InvocationContext
})

/** Context reserved for trusted internal seeds, jobs, and workflows. */
export const systemInvocation: InvocationContext = {
  actorId: SYSTEM_ACTOR_ID,
  rootId: PLATFORM_ID,
}
