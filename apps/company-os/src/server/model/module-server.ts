import type { ModuleDefinition, ObjectType } from "@company/runtime"
import type {
  CustomOperationService,
  ObjectImplementation,
} from "@company/runtime/effect/model-implementation"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Model } from "company-os/model"
import { Context, Effect, Layer } from "effect"

import { CommittedChanges } from "@/server/database/committed-changes"
import { PendingEvents } from "@/server/events/event-buffer"

type Bound<O extends ObjectType> = O["id"] extends keyof typeof Model.objects
  ? (typeof Model.objects)[O["id"]]
  : never
type Overrides<O extends ObjectType> = CustomOperationService<
  Bound<O>,
  unknown
> &
  Partial<
    Omit<
      ObjectImplementation<Bound<O>, unknown>,
      keyof CustomOperationService<Bound<O>>
    >
  >
type ModuleOverrides<M extends ModuleDefinition> = {
  readonly [
    O in M["objects"][number] as keyof CustomOperationService<O> extends never
      ? never
      : O["id"]
  ]: Overrides<O>
} & {
  readonly [O in M["objects"][number] as O["id"]]?: Overrides<O>
}
type Requirements<A> = A extends object
  ? {
      [K in keyof A]-?: A[K] extends (
        ...args: never[]
      ) => Effect.Effect<unknown, unknown, infer R>
        ? R
        : Requirements<A[K]>
    }[keyof A]
  : never

function bindOperation<R>(
  key: string,
  operation: unknown,
  context: Context.Context<R>
) {
  if (typeof operation !== "function")
    throw new Error(`Operation '${key}' must be a function.`)
  // SAFETY: ModuleOverrides checks the concrete input/output and infers requirements.
  // This dynamic registry erases those types only after binding its infrastructure.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const invoke = operation as (
    input: unknown
  ) => Effect.Effect<unknown, unknown, R | CurrentInvocation>
  return (input: unknown) => invoke(input).pipe(Effect.provideContext(context))
}

/** Binds only custom operations and standard overrides. Infrastructure is captured once;
 * CurrentInvocation stays request-local and is never captured during startup. */
export function defineModuleServer<
  M extends ModuleDefinition,
  A extends ModuleOverrides<NoInfer<M>>,
  E,
  R,
  LR = never,
  LE = never,
  LI = never,
>(
  module: M,
  implementations: Effect.Effect<A, E, R>,
  layer?: Layer.Layer<LR, LE, LI>
) {
  const installed: ReadonlyArray<ModuleDefinition> = Object.values(
    Model.modules
  )
  if (!installed.includes(module))
    throw new Error(
      `Server module '${module.id}' is not installed in the model.`
    )
  return {
    module,
    layer: layer ?? Layer.empty,
    services: Effect.gen(function* () {
      const overrides = yield* implementations
      const context = (yield* Effect.context<
        Exclude<Requirements<A>, CurrentInvocation>
      >()).pipe(
        Context.omit(CurrentInvocation, CommittedChanges, PendingEvents)
      )
      const owned = new Map(
        module.objects.map((object) => [
          object.id,
          new Set([
            "get",
            "list",
            "batchGet",
            ...Object.keys(object.actions),
            ...Object.keys(object.queries),
          ]),
        ])
      )
      const bound: Record<string, object> = {}
      for (const [id, operations] of Object.entries(overrides)) {
        const allowed = owned.get(id)
        if (allowed === undefined)
          throw new Error(
            `Module '${module.id}' cannot implement object '${id}'.`
          )
        if (typeof operations !== "object" || operations === null)
          throw new Error(`Invalid implementation for '${id}'.`)
        const methods: Record<
          string,
          (input: unknown) => Effect.Effect<unknown, unknown, CurrentInvocation>
        > = {}
        for (const [name, operation] of Object.entries(operations)) {
          if (!allowed.has(name))
            throw new Error(
              `Operation '${id}.${name}' is not declared in the model.`
            )
          methods[name] = bindOperation(`${id}.${name}`, operation, context)
        }
        bound[id] = methods
      }
      return bound
    }),
  }
}
