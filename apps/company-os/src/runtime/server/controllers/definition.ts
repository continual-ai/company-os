import type { Effect } from "effect"

import type { EventPage } from "#/runtime/contract/events.ts"
import type { ControllerDuration } from "#/runtime/model/definition/controller.ts"
import { type Controller, RecordId } from "#/runtime/model/index.ts"

export interface ReconcileResult {
  readonly requeueAfter?: ControllerDuration
}

export type ControllerEvent = EventPage["items"][number]
export interface ControllerServer<R = never> {
  readonly definition: Controller
  readonly reconcile: (
    key: string
  ) => Effect.Effect<void | ReconcileResult, unknown, R>
  readonly onEvent?: (
    event: ControllerEvent,
    context: {
      readonly queue: {
        readonly add: (key?: string) => Effect.Effect<void, unknown>
      }
    }
  ) => Effect.Effect<void, unknown, R>
}

type Handlers<S extends "object" | "collection", T extends string, R> = {
  readonly reconcile: (
    ...args: S extends "object" ? [key: RecordId<T>] : []
  ) => Effect.Effect<void | ReconcileResult, unknown, R>
  readonly onEvent?: (
    event: ControllerEvent,
    context: {
      readonly queue: {
        readonly add: (
          ...args: S extends "object" ? [key: RecordId<T>] : []
        ) => Effect.Effect<void, unknown>
      }
    }
  ) => Effect.Effect<void, unknown, R>
}

/** Bind typed handlers to the string keys used by durable storage. */
export function defineControllerServer<
  S extends "object" | "collection",
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
        definition.scope === "object"
          ? [RecordId<string>(definition.objectType)(key)]
          : []
      ) as Parameters<typeof handlers.reconcile>
      return handlers.reconcile(...args)
    },
    ...(handlers.onEvent
      ? {
          onEvent: (event, context) =>
            handlers.onEvent!(event, {
              queue: { add: (...keys) => context.queue.add(keys[0]) },
            }),
        }
      : {}),
  }
}
