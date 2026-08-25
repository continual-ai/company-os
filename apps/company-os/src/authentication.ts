import type { RecordId } from "@company/runtime"

/** Browser-safe projection of the canonical User associated with a session. */
export interface AuthenticatedUser {
  readonly email: string
  readonly id: RecordId<"user">
  readonly name: string
}
