import { Effect } from "effect"

import {
  modelOperations,
  type ModelOperation,
} from "#/runtime/contract/operations.ts"
import { moduleDependencies } from "#/runtime/model/definition/validate-model.ts"
import {
  defineModel,
  type ModelCatalog,
  type ApiError,
  type FailedPreconditionError,
} from "#/runtime/model/index.ts"
import {
  ModuleSetting,
  moduleActivationPlan,
  requiredModuleIds,
} from "#/runtime/platform/model/index.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { ObjectRepositories as Records } from "#/runtime/server/model/object-repositories.ts"
import { Database } from "#/runtime/server/storage/database.ts"

const readModuleCatalog = Effect.fn("platform.readModuleCatalog")(function* () {
  const context = yield* ModelContext
  const { model } = context
  const { sql } = yield* Database
  const states = yield* sql<{
    moduleId: string
    enabled: boolean
  }>`select module_id as "moduleId", enabled from ${context.table(ModuleSetting)}`
  const enabled = new Map(
    states.map((state) => [state.moduleId, state.enabled])
  )
  return Object.values(model.modules).map((module) => {
    const maintainer = module.maintainer ?? model.maintainer
    return {
      id: module.id,
      name: module.name,
      description: module.description ?? "",
      ...(module.maturity ? { maturity: module.maturity } : {}),
      ...(maintainer
        ? {
            maintainer: {
              name: maintainer.name,
              ...(maintainer.email ? { email: maintainer.email } : {}),
            },
          }
        : {}),
      ...(module.origin
        ? {
            origin: {
              name: module.origin.name,
              ...(module.origin.url ? { url: module.origin.url } : {}),
            },
          }
        : {}),
      enabled: enabled.get(module.id) ?? false,
      required: requiredModuleIds.some((id) => id === module.id),
      dependencies: moduleDependencies(
        module,
        Object.values(model.modules)
      ).map(({ moduleId }) => moduleId),
      objects: module.objects.map((object) => object.pluralName),
    }
  })
})

const activeModels = new WeakMap<
  ModelCatalog,
  { key: string; model: ModelCatalog; operations: Set<string> }
>()
export const activeModuleModel = Effect.fn("platform.activeModuleModel")(
  function* () {
    const { model } = yield* ModelContext
    const catalog = yield* readModuleCatalog()
    const ids = catalog
      .filter((module) => module.enabled)
      .map((module) => module.id)
    const key = JSON.stringify(ids)
    const cached = activeModels.get(model)
    if (cached?.key === key) return cached
    const active = defineModel({
      name: model.name,
      maintainer: model.maintainer,
      modules: Object.values(model.modules).filter((module) =>
        ids.includes(module.id)
      ),
    })
    const result = {
      key,
      model: active,
      operations: new Set(
        modelOperations(active).map(({ key: operation }) => operation)
      ),
    }
    activeModels.set(model, result)
    return result
  }
)

export const requireModuleOperation = Effect.fn(
  "platform.requireModuleOperation"
)(function* (descriptor: ModelOperation) {
  const active = yield* activeModuleModel()
  if (!active.operations.has(descriptor.key))
    return yield* Effect.fail({
      status: "PERMISSION_DENIED" as const,
      reason: "PERMISSION_DENIED",
      message: "This module is disabled.",
      details: {},
    })
  return undefined
})

export const moduleCatalog = Effect.fn("platform.moduleCatalog")(function* () {
  yield* requireProjectAccess
  return { modules: yield* readModuleCatalog() }
})

const fail = (message: string): ApiError<typeof FailedPreconditionError> => ({
  status: "FAILED_PRECONDITION",
  reason: "FAILED_PRECONDITION",
  message,
  details: { violations: [] },
})
export const setModuleEnabled = Effect.fn("platform.setModuleEnabled")(
  function* (input: {
    moduleId: string
    enabled: boolean
    disableDependents?: ReadonlyArray<string>
  }) {
    const database = yield* Database
    const records = yield* Records
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* requireProjectAccess
        // Serialize dependency changes so simultaneous toggles cannot leave an invalid active set.
        yield* database.sql`select pg_advisory_xact_lock(hashtext('company_os_module_activation'))`
        const catalog = yield* readModuleCatalog()
        const target = catalog.find((module) => module.id === input.moduleId)
        if (!target)
          return yield* Effect.fail(fail("This module is not installed."))
        if (!input.enabled && target.required)
          return yield* Effect.fail(
            fail(`${target.name} is required by the application.`)
          )
        const changes = moduleActivationPlan(
          catalog,
          input.moduleId,
          input.enabled
        )
        if (!input.enabled) {
          if (changes.some((module) => module.required))
            return yield* Effect.fail(
              fail("Required platform modules must stay enabled.")
            )
          const unconfirmed = changes.filter(
            (module) =>
              module.id !== input.moduleId &&
              !input.disableDependents?.includes(module.id)
          )
          if (unconfirmed.length)
            return yield* Effect.fail(
              fail(
                `Also turning off ${unconfirmed.map((module) => module.name).join(", ")} requires confirmation. Review the module dependencies and try again.`
              )
            )
        }
        const enabled = new Set(
          catalog.filter((module) => module.enabled).map((module) => module.id)
        )
        for (const module of changes) {
          if (input.enabled) enabled.add(module.id)
          else enabled.delete(module.id)
        }
        const repository = records.get(ModuleSetting)
        const stored = yield* repository.list({ pageSize: 1000 })
        for (const state of stored.items) {
          const next = enabled.has(state.moduleId)
          if (state.enabled !== next)
            yield* records
              .writer(ModuleSetting)
              .update({ id: state.id, etag: state.etag, enabled: next })
        }
        return { enabledModules: [...enabled] }
      })
    )
  }
)
