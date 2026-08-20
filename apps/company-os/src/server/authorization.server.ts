import type {
  AuthorizationRequest,
  CurrentActor,
  InvocationContext,
} from "@continual/runtime/effect/object-service"
import { Context, Data, type Effect } from "effect"

class PermissionDenied extends Data.TaggedError("PermissionDenied")<{
  readonly objectId: string
  readonly operation: AuthorizationRequest["operation"]
}> {}

export interface AuthorizationService {
  readonly require: (
    request: AuthorizationRequest
  ) => Effect.Effect<InvocationContext, PermissionDenied, CurrentActor>
}

/** Implemented from Acme's authenticated actor and company-owned policy. */
export class Authorization extends Context.Service<
  Authorization,
  AuthorizationService
>()("@acme/Authorization") {}
