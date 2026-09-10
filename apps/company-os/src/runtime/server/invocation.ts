import { Context } from "effect"

import type { ActorId } from "#/runtime/model/core/actor.ts"

export interface InvocationContext {
  /** Actor durably attributed to writes performed by this invocation. */
  readonly actorId: ActorId
}

/** Actor selected by a trusted invocation boundary. */
export class CurrentInvocation extends Context.Service<
  CurrentInvocation,
  InvocationContext
>()("@company/runtime/CurrentInvocation") {}
