import type { ActorId, IdentityId } from "@company/model"

import { ANONYMOUS_ACTOR_ID } from "@/system-records"

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

/** Recovers request authorization state from a trusted durable audit actor. */
export function callerForActor(actorId: ActorId): Caller {
  if (actorId === ANONYMOUS_ACTOR_ID) return anonymousCaller
  // SAFETY: AnonymousActor is the only Actor implementation that is not also
  // an Identity, and its stable ID was excluded above.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return identityCaller(actorId as IdentityId)
}
