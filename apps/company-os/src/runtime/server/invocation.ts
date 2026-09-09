import { Context } from "effect"

import type { RecordId } from "#/runtime/model/definition/schema.ts"

export interface InvocationContext {
  /** Actor durably attributed to writes performed by this invocation. */
  readonly actorId: RecordId
  /** Actor whose business authority is evaluated for this invocation. */
  readonly authorizationActorId: RecordId
}

/** Actor selected by a trusted invocation boundary. */
export class CurrentInvocation extends Context.Service<
  CurrentInvocation,
  InvocationContext
>()("@company/runtime/CurrentInvocation") {}
