import { Data } from "effect"

export class InvitationInvalid extends Data.TaggedError("InvitationInvalid")<{
  readonly reason:
    | "accepted"
    | "emailMismatch"
    | "expired"
    | "revoked"
    | "token"
    | "unverifiedEmail"
}> {}
