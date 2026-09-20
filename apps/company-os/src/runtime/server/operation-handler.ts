import { Effect } from "effect"

import type { FinalSnapshots } from "#/runtime/server/events/record-snapshots.ts"
import type { CurrentInvocation } from "#/runtime/server/invocation.ts"

/** Handlers perform work now and return an effect that reads their response at completion. */
export type OperationHandler = (
  input: unknown
) => Effect.Effect<
  Effect.Effect<unknown, unknown, CurrentInvocation | FinalSnapshots>,
  unknown,
  CurrentInvocation
>

export function completeImmediately<I, A, E, R>(
  handler: (input: I) => Effect.Effect<A, E, R>
) {
  return (input: I) => handler(input).pipe(Effect.map(Effect.succeed))
}

/** The model validates inputs before this single dynamic dispatch boundary. */
export function operationMethod(group: object, name: string): OperationHandler {
  const handler: unknown = Reflect.get(group, name)
  if (typeof handler !== "function")
    throw new Error(`Operation '${name}' has no implementation.`)
  // SAFETY: built-in handlers and custom adapters are constructed with this completion contract.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return handler as OperationHandler
}
