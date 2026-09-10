import { Context, Data, type Effect } from "effect"

import type { IdentityId } from "#/runtime/access/model/ids.ts"

/** Provider-neutral identity after credentials AND admission to this project have been verified. */
export interface AuthenticatedSubject {
  readonly email: string | undefined
  readonly issuer: string
  readonly kind: "serviceAccount" | "user"
  readonly name: string | undefined
  /** Optional canonical App ID. Continual supplies its existing `us_…` ID. */
  readonly preferredIdentityId?: IdentityId | undefined
  readonly subject: string
}

export class InvalidIdentityAssertion extends Data.TaggedError(
  "InvalidIdentityAssertion"
)<{ readonly reason: string }> {}

/** Verifies credentials and access to this specific project; a valid login alone is insufficient. */
export class IdentityProvider extends Context.Service<
  IdentityProvider,
  {
    readonly identify: (
      headers: Headers
    ) => Effect.Effect<AuthenticatedSubject | null, InvalidIdentityAssertion>
  }
>()("@company/IdentityProvider") {}
