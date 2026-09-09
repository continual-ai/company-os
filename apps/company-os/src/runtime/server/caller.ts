import type { ActorId, IdentityId } from "#/runtime/access/model/ids.ts"
import { ANONYMOUS_ACTOR_ID } from "#/runtime/model/system-records.ts"

/** Authentication state presented to authorization before an actor is required. */
export type Caller =
  | { readonly kind: "anonymous" }
  | { readonly kind: "authenticated" }
  | { readonly identityId: IdentityId; readonly kind: "identity" }

export const anonymousCaller = { kind: "anonymous" } as const satisfies Caller
export const authenticatedCaller = {
  kind: "authenticated",
} as const satisfies Caller

export function identityCaller(identityId: IdentityId): Caller {
  return { identityId, kind: "identity" }
}

function isIdentityActorId(actorId: ActorId): actorId is IdentityId {
  return actorId !== ANONYMOUS_ACTOR_ID
}

/** Recovers request authorization state from a trusted durable audit actor. */
export function callerForActor(actorId: ActorId): Caller {
  return isIdentityActorId(actorId) ? identityCaller(actorId) : anonymousCaller
}
