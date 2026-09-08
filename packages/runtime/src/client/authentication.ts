import type { IdentityId } from "#/model/access/ids.ts"

/** Browser-safe projection of the authenticated App user. */
export interface AuthenticatedUser {
  readonly email: string | null
  readonly id: IdentityId
  readonly name: string
}
