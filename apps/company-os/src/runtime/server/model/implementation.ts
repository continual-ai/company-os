import { Context, Effect, Layer } from "effect"

import type {
  ModelCatalog,
  ModuleDefinition,
  ObjectType,
} from "#/runtime/model/index.ts"
import type { Authorization } from "#/runtime/server/authorization/authorization-service.ts"
import type { CurrentInvocation } from "#/runtime/server/invocation.ts"
import type { ModelContext } from "#/runtime/server/model-context.ts"
import {
  implementModel,
  type ModelServiceMap,
  type ModelImplementation as Implementation,
} from "#/runtime/server/model-implementation.ts"
import { Links } from "#/runtime/server/model/link-service.ts"
import type { OperationRequirements } from "#/runtime/server/model/module-server.ts"
import type { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import { makeObjectService } from "#/runtime/server/model/object-service.ts"
import type { RecordIdentifierResolver } from "#/runtime/server/model/record-identifier-resolver.ts"
import type { Database } from "#/runtime/server/storage/database.ts"

type Contribution = {
  readonly module: ModuleDefinition
  readonly implementations: Effect.Effect<object, unknown, unknown>
}
export type ModuleRequirements<C extends ReadonlyArray<Contribution>> =
  C[number] extends infer S
    ? S extends {
        readonly implementations: Effect.Effect<infer A, unknown, infer R>
      }
      ? R | Exclude<OperationRequirements<A>, CurrentInvocation>
      : never
    : never

type Foundation =
  | ModelContext
  | ObjectRepositories
  | Links
  | Authorization
  | Database
  | RecordIdentifierResolver

/** Runtime dispatch is erased once; domain callers recover types against the installed definition. */
export class ModelImplementation extends Context.Service<
  ModelImplementation,
  {
    readonly model: ModelCatalog
    readonly services: Readonly<Record<string, object>>
    readonly links: Pick<typeof Links.Service, "link" | "list" | "unlink">
  }
>()("@company/runtime/ModelImplementation") {}

/** Returns the typed implementation only for the exact installed model. */
export function modelImplementation<M extends ModelCatalog>(model: M) {
  return Effect.gen(function* () {
    const implementation = yield* ModelImplementation
    if (implementation.model !== model)
      throw new Error("The requested model is not installed.")
    // SAFETY: the dispatch map was validated against this exact model during assembly.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return implementation as unknown as Implementation<M>
  })
}

/** Binds against the explicit service layer's output, never the ambient request or transaction context. */
export function modelImplementationLayer<
  const C extends ReadonlyArray<Contribution>,
  E,
  R,
>(
  model: ModelCatalog,
  contributions: C,
  services: Layer.Layer<Foundation | ModuleRequirements<C>, E, R>
) {
  return Layer.effect(
    ModelImplementation,
    Effect.gen(function* () {
      const context = yield* Layer.build(services)
      const foundationContext: Context.Context<Foundation> = context
      const links = Context.get(context, Links)
      const overrides: Record<string, object> = {}
      for (const contribution of contributions) {
        // Contributions for modules outside this model (disabled ones) are skipped.
        if (!Object.values(model.modules).includes(contribution.module))
          continue
        // SAFETY: C retains the concrete factory requirements, satisfied by the supplied service layer.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion, effecttsgo/unsafe-effect-type-assertion
        const factory = contribution.implementations as Effect.Effect<
          object,
          unknown,
          ModuleRequirements<C>
        >
        const implementations = yield* factory.pipe(
          Effect.provideContext(context)
        )
        for (const [id, operations] of Object.entries(implementations)) {
          const object = contribution.module.objects.find(
            (candidate) => candidate.id === id
          )
          if (!object)
            throw new Error(
              `Module '${contribution.module.id}' cannot implement object '${id}'.`
            )
          if (Object.hasOwn(overrides, id))
            throw new Error(`Duplicate implementation for '${id}'.`)
          const allowed = new Set([
            "get",
            "list",
            "batchGet",
            ...Object.keys(object.actions),
            ...Object.keys(object.queries),
          ])
          const bound: Record<
            string,
            (
              input: unknown
            ) => Effect.Effect<unknown, unknown, CurrentInvocation>
          > = {}
          if (typeof operations !== "object" || operations === null)
            throw new Error(`Invalid operations for ${id}.`)
          for (const [name, operation] of Object.entries(operations)) {
            if (!allowed.has(name) || typeof operation !== "function")
              throw new Error(`Invalid implementation for '${id}.${name}'.`)
            // SAFETY: defineModuleServer checks inputs, outputs and requirements before this dispatch boundary.
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            const invoke = operation as (
              input: unknown
            ) => Effect.Effect<
              unknown,
              unknown,
              ModuleRequirements<C> | CurrentInvocation
            >
            bound[name] = (input) =>
              invoke(input).pipe(Effect.provideContext(context))
          }
          overrides[id] = bound
        }
      }
      const objects: ReadonlyArray<ObjectType> = Object.values(model.objects)
      const entries = yield* Effect.forEach(objects, (object) =>
        makeObjectService(object).pipe(
          Effect.provideContext(foundationContext),
          Effect.map(
            (standard: object) =>
              [object.id, { ...standard, ...overrides[object.id] }] as const
          )
        )
      )
      // SAFETY: each model object is constructed once; implementModel validates every declared method.
      return implementModel<ModelCatalog>(
        model,
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        Object.fromEntries(entries) as unknown as ModelServiceMap<ModelCatalog>,
        links
      )
    })
  )
}
