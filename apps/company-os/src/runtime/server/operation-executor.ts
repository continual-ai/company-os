import { Context, Effect, Layer, Schema } from "effect"

import {
  operationContracts,
  projectOperations,
  type OperationContract,
} from "#/runtime/contract/operation-contract.ts"
import { toEffectRecordIdentifierSchema } from "#/runtime/contract/schema.ts"
import type {
  ApiError,
  ModelCatalog,
  ModuleDefinition,
} from "#/runtime/model/index.ts"
import type {
  LinkListInput,
  LinkMutationInput,
} from "#/runtime/model/link-input.ts"
import {
  activeModuleModel,
  requireModuleOperation,
} from "#/runtime/platform/server/activation.ts"
import { withApiErrors } from "#/runtime/server/api-error.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { Database } from "#/runtime/server/database.ts"
import {
  CurrentInvocation,
  type InvocationContext,
} from "#/runtime/server/invocation.ts"
import type { ModelContext } from "#/runtime/server/model-context.ts"
import type { OperationRequirements } from "#/runtime/server/module-server.ts"
import { type OperationServices } from "#/runtime/server/operation-handlers.ts"
import { runOperation } from "#/runtime/server/operation-mode.ts"
import { assertRecordWritable } from "#/runtime/server/operation-policy.ts"
import { createRecordBatchGet } from "#/runtime/server/record-batch.ts"
import { createRecordSearch } from "#/runtime/server/record-search.ts"
import { CommittedChanges } from "#/runtime/server/storage/committed-changes.ts"
import type { RecordIdentifiers } from "#/runtime/server/storage/identifiers.ts"
import { Links } from "#/runtime/server/storage/link-store.ts"
import type { RecordStore } from "#/runtime/server/storage/record-store.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

type Contribution = {
  readonly module: ModuleDefinition
  readonly operations: object
}
type OperationModuleRequirements<C extends ReadonlyArray<Contribution>> =
  Exclude<OperationRequirements<C[number]["operations"]>, CurrentInvocation>

type Foundation =
  | Database
  | ModelContext
  | RecordStore
  | Links
  | SqlDatabase
  | RecordIdentifiers

type Handler = (
  input: unknown
) => Effect.Effect<unknown, unknown, CurrentInvocation>

function method(group: object, name: string): Handler {
  const handler: unknown = Reflect.get(group, name)
  if (typeof handler !== "function")
    throw new Error(`Operation '${name}' has no implementation.`)
  // SAFETY: the installed model selects the repository method or a checked custom implementation.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return handler as Handler
}

/** Runtime dispatch is erased once; domain callers recover types against the installed definition. */
export class OperationExecutor extends Context.Service<
  OperationExecutor,
  {
    readonly run: (
      invocation: InvocationContext,
      contract: OperationContract,
      input: unknown
    ) => Effect.Effect<{ value: unknown; changes: string[] }, ApiError>
    readonly activeModel: Effect.Effect<
      Effect.Success<ReturnType<typeof activeModuleModel>>,
      unknown
    >
    readonly model: ModelCatalog
    readonly services: Readonly<Record<string, unknown>>
  }
>()("@company/runtime/OperationExecutor") {
  static readonly layer = operationExecutorLayer
}

/** Returns the typed implementation only for the exact installed model. */
export function operationsFor<M extends ModelCatalog>(model: M) {
  return Effect.gen(function* () {
    const implementation = yield* OperationExecutor
    if (implementation.model !== model)
      throw new Error("The requested model is not installed.")
    // SAFETY: the dispatch map was validated against this exact model during assembly.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return implementation.services as unknown as OperationServices<M>
  })
}

/** Binds against the explicit service layer's output, never the ambient request or transaction context. */
function operationExecutorLayer<
  const C extends ReadonlyArray<Contribution>,
  E,
  R,
>(
  model: ModelCatalog,
  contributions: C,
  services: Layer.Layer<Foundation | OperationModuleRequirements<C>, E, R>
) {
  return Layer.effect(
    OperationExecutor,
    Effect.gen(function* () {
      const context = yield* Layer.build(services)
      const foundationContext: Context.Context<Foundation> = context
      const links = Context.get(context, Links)
      const database = Context.get(context, SqlDatabase)
      const repositories = Context.get(context, Database)
      const customHandlers = new Map<string, Handler>()
      for (const contribution of contributions) {
        if (!Object.values(model.modules).includes(contribution.module))
          continue
        const declared = new Set(
          [...contribution.module.actions, ...contribution.module.queries].map(
            (operation) => operation.key
          )
        )
        for (const [id, value] of Object.entries(contribution.operations)) {
          const entries =
            typeof value === "function"
              ? [[id, value] as const]
              : typeof value === "object" && value !== null
                ? Object.entries(value).map(
                    ([name, handler]) => [`${id}.${name}`, handler] as const
                  )
                : []
          if (entries.length === 0)
            throw new Error(`Invalid operations for '${id}'.`)
          for (const [key, implementation] of entries) {
            if (!declared.delete(key) || typeof implementation !== "function")
              throw new Error(
                `Invalid implementation for '${key}' in module '${contribution.module.id}'.`
              )
            if (customHandlers.has(key))
              throw new Error(`Duplicate implementation for '${key}'.`)
            // SAFETY: defineModuleServer retains every handler requirement; the explicit service layer satisfies them.
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            const invoke = implementation as (
              input: unknown
            ) => Effect.Effect<
              unknown,
              unknown,
              OperationModuleRequirements<C> | CurrentInvocation
            >
            customHandlers.set(key, (input) =>
              invoke(input).pipe(Effect.provideContext(context))
            )
          }
        }
        for (const key of declared)
          throw new Error(`Operation '${key}' has no implementation.`)
      }

      const activeModel = activeModuleModel().pipe(
        Effect.provideContext(foundationContext)
      )
      const bind = (contract: OperationContract, handler: Handler): Handler => {
        const decode = Schema.decodeUnknownEffect(contract.input)
        const validate = Schema.decodeUnknownEffect(contract.output)
        return (input) =>
          runOperation(
            database,
            contract.kind,
            Effect.gen(function* () {
              yield* requireProjectAccess
              const decoded = yield* decode(input ?? {})
              // Public editability belongs here; repository invariants apply to every caller.
              if (
                contract.object &&
                contract.kind === "action" &&
                contract.id !== "create" &&
                !customHandlers.has(contract.key)
              ) {
                const object = contract.object
                const repository = repositories.repository(object)
                const records =
                  contract.id === "batchDelete"
                    ? (yield* repository.batchGet(
                        yield* Schema.decodeUnknownEffect(
                          Schema.Struct({
                            ids: Schema.Array(
                              toEffectRecordIdentifierSchema(object.id)
                            ),
                          })
                        )(decoded)
                      )).items
                    : [
                        yield* repository.get(
                          yield* Schema.decodeUnknownEffect(
                            Schema.Struct({
                              id: toEffectRecordIdentifierSchema(object.id),
                            })
                          )(decoded)
                        ),
                      ]
                for (const record of records)
                  yield* assertRecordWritable(object, record)
              }
              const result = yield* handler(decoded)
              yield* validate(result ?? {}).pipe(Effect.orDie)
              return result
            })
          )
      }
      const contracts = operationContracts(model)
      const handlers = new Map(
        contracts.map((contract) => {
          const custom = customHandlers.get(contract.key)
          const traversal = contract.linkTraversal
          let handler: Handler
          if (contract.builtin)
            handler = (input) =>
              activeModel.pipe(
                Effect.flatMap(({ model: active }) => {
                  const read =
                    contract.builtin === "batchGetRecords"
                      ? createRecordBatchGet(active)
                      : createRecordSearch(active)
                  return method({ read }, "read")(input)
                }),
                Effect.provideContext(foundationContext)
              )
          else if (custom) handler = custom
          else if (traversal)
            handler = (input) => {
              if (contract.kind === "query") {
                // SAFETY: the operation's input schema validates this traversal request.
                // oxlint-disable-next-line typescript/no-unsafe-type-assertion
                const page = links.list(traversal, input as LinkListInput)
                return contract.id === "get"
                  ? page.pipe(
                      Effect.map((value) => ({ item: value.items[0] ?? null }))
                    )
                  : page
              }
              // SAFETY: the operation's input schema validates this mutation request.
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion
              const mutation = input as LinkMutationInput
              return contract.id === "link"
                ? links.link(traversal, mutation)
                : links.unlink(traversal, mutation)
            }
          else {
            if (!contract.object)
              throw new Error(
                `Operation '${contract.key}' has no implementation.`
              )
            handler = method(
              repositories.repository(contract.object),
              contract.id
            )
          }
          return [contract.key, bind(contract, handler)] as const
        })
      )
      return {
        model,
        services: projectOperations(contracts, (contract) =>
          handlers.get(contract.key)!
        ),
        activeModel,
        run: (
          invocation: InvocationContext,
          contract: OperationContract,
          input: unknown
        ) => {
          const handler = handlers.get(contract.key)
          if (!handler)
            return Effect.die(`Operation '${contract.key}' is not installed.`)
          const changes = new Set<string>()
          return withApiErrors(
            requireProjectAccess.pipe(
              Effect.andThen(
                (contract.builtin
                  ? Effect.void
                  : requireModuleOperation(contract)
                ).pipe(Effect.provideContext(foundationContext))
              ),
              Effect.andThen(handler(input))
            ),
            contract
          ).pipe(
            Effect.provideService(CurrentInvocation, invocation),
            Effect.provideService(CommittedChanges, changes),
            Effect.map((value) => ({ value, changes: [...changes].sort() }))
          )
        },
      }
    })
  )
}
