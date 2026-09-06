import type { IdentityId } from "company-os/model"

/** Browser-safe projection of the authenticated App user. */
export interface AuthenticatedUser {
  readonly email: string | null
  readonly id: IdentityId
  readonly name: string
}
