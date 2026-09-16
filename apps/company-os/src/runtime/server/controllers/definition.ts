import type { Effect } from "effect"

import type { ControllerDuration } from "#/runtime/model/definition/controller.ts"
import { type Controller, RecordId } from "#/runtime/model/index.ts"
export interface ReconcileResult {
  readonly requeueAfter?: ControllerDuration
}

export interface ControllerServer<R = never> {
  readonly definition: Controller
  readonly reconcile: (
    key: string
  ) => Effect.Effect<void | ReconcileResult, unknown, R>
}

type Handlers<S extends "record" | "object", T extends string, R> = {
  readonly reconcile: (
    ...args: S extends "record" ? [key: RecordId<T>] : []
  ) => Effect.Effect<void | ReconcileResult, unknown, R>
}

/** Bind typed handlers to the string keys used by durable storage. */
export function defineControllerServer<
  S extends "record" | "object",
  T extends string,
  R,
>(
  definition: Controller<S, T>,
  handlers: Handlers<NoInfer<S>, NoInfer<T>, R>
): ControllerServer<R> {
  return {
    definition,
    reconcile: (key) => {
      // SAFETY: the definition's scope determines exactly the handler's argument tuple.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const args = (
        definition.scope === "record"
          ? [RecordId<string>(definition.objectType)(key)]
          : []
      ) as Parameters<typeof handlers.reconcile>
      return handlers.reconcile(...args)
    },
  }
}
