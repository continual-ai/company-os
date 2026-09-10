import { Effect } from "effect"

import { RecordId } from "#/runtime/model/index.ts"
import { ROOT_ID } from "#/runtime/model/system-records.ts"
import {
  ModuleSetting,
  requiredModuleIds,
} from "#/runtime/platform/model/index.ts"
import { currentActorId } from "#/runtime/server/invocation-context.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { makeObjectSeedRepository } from "#/runtime/server/model/object-repositories.ts"
import { Database } from "#/runtime/server/storage/database.ts"

/** Initialize once; later migrations preserve selections and leave newly installed optional modules off. */
export const seedModuleSettings = Effect.fn("platform.seedModuleSettings")(
  function* () {
    const context = yield* ModelContext
    const { model } = context
    const { sql } = yield* Database
    const repository = yield* makeObjectSeedRepository(ModuleSetting)
    const actor = yield* currentActorId
    const existing = yield* sql<{
      moduleId: string
    }>`select module_id as "moduleId" from ${context.table(ModuleSetting)}`
    for (const module of Object.values(model.modules)) {
      if (existing.some((row) => row.moduleId === module.id)) continue
      yield* repository.upsert({
        id: RecordId(ModuleSetting.id)(`module_${module.id}`),
        moduleId: module.id,
        enabled:
          existing.length === 0 ||
          requiredModuleIds.some((id) => id === module.id),
        parent: ROOT_ID,
        aliases: [],
        metadata: {},
        systemManaged: true,
        createdBy: actor,
        updatedBy: actor,
      })
    }
  }
)
