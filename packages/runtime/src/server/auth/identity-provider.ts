import { Context, Data, type Effect } from "effect"

import type { IdentityId } from "#/model/access/ids.ts"

type IdentityKind = "serviceAccount" | "user"

/** Provider-neutral identity after credentials have been verified. */
export interface AuthenticatedSubject {
  readonly email: string | undefined
  readonly issuer: string
  readonly kind: IdentityKind
  readonly name: string | undefined
  /** Optional canonical App ID. Continual supplies its existing `us_…` ID. */
  readonly preferredIdentityId?: IdentityId | undefined
  readonly subject: string
}

export interface VerifiedIdentityInvocation {
  readonly actor: AuthenticatedSubject
  readonly authorizationSubject: AuthenticatedSubject
}

export class InvalidIdentityAssertion extends Data.TaggedError(
  "InvalidIdentityAssertion"
)<{ readonly reason: string }> {}

/** Verifies external credentials; the host supplies its concrete provider layer. */
export class IdentityProvider extends Context.Service<
  IdentityProvider,
  {
    readonly identify: (
      headers: Headers
    ) => Effect.Effect<
      VerifiedIdentityInvocation | null,
      InvalidIdentityAssertion
    >
  }
>()("@company/IdentityProvider") {}
