import { Effect } from "effect"

import {
  ModuleSetting,
  requiredModuleIds,
} from "#/runtime/platform/model/index.ts"
import { moduleAlias } from "#/runtime/platform/model/module-setting.ts"
import { syncConnectors } from "#/runtime/platform/server/sync-connectors.ts"
import { syncControllers } from "#/runtime/platform/server/sync-controllers.ts"
import { Database } from "#/runtime/server/database.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"

/** Initialize once; preserve selections and leave newly installed optional modules off. */
export const seedModuleSettings = Effect.fn("platform.seedModuleSettings")(
  function* () {
    const { model } = yield* ModelContext
    const database = yield* Database
    const repository = database.repository(ModuleSetting)
    yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* database.sql`select pg_advisory_xact_lock(hashtext('company_os_module_registration'))`
        const existing = yield* database.sql<{
          moduleId: string
        }>`select module_id as "moduleId" from ${database.table(ModuleSetting)}`
        for (const module of Object.values(model.modules)) {
          if (existing.some((row) => row.moduleId === module.id)) continue
          yield* repository.upsert({
            alias: moduleAlias(module.id),
            values: {
              moduleId: module.id,
              enabled:
                existing.length === 0 ||
                requiredModuleIds.some((id) => id === module.id),
            },
          })
        }
      })
    )
    yield* syncControllers()
    yield* syncConnectors()
  }
)
