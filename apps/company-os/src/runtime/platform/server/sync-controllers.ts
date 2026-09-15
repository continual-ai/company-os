import { Effect } from "effect"

import { type PageToken } from "#/runtime/model/index.ts"
import {
  Controller,
  controllerAlias,
} from "#/runtime/platform/model/controller.ts"
import { moduleAlias } from "#/runtime/platform/model/module-setting.ts"
import { Database } from "#/runtime/server/database.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import {
  controllerConsumers,
  controllerInstances,
} from "#/runtime/server/storage/infrastructure.ts"

/** Definitions converge through normal repository writes; aliases preserve identity across deployments. */
export const syncControllers = Effect.fn("platform.syncControllers")(
  function* () {
    const { model } = yield* ModelContext
    if (!model.objects[Controller.id]) return
    const database = yield* Database
    const controllers = database.repository(Controller)
    yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* database.sql`select pg_advisory_xact_lock(hashtext('company_os_controller_registry'))`
        const registered = new Set<string>()
        for (const module of Object.values(model.modules)) {
          for (const definition of module.controllers) {
            const record = yield* controllers.upsert({
              alias: controllerAlias(definition.id),
              values: {
                definitionId: definition.id,
                name: definition.name,
                description: definition.description,
                targetObjectType: definition.objectType,
                scope: definition.scope,
                watch: [...definition.watch],
                schedule: definition.schedule ?? null,
                minInterval: definition.minInterval ?? null,
              },
              links: {
                module: moduleAlias(module.id),
              },
            })
            registered.add(record.id)
          }
        }
        let pageToken: PageToken | undefined
        do {
          const page = yield* controllers.list({
            pageSize: 100,
            ...(pageToken ? { pageToken } : {}),
          })
          for (const record of page.items) {
            if (registered.has(record.id)) continue
            yield* controllers.delete({ id: record.id })
            yield* database.sql`delete from ${controllerConsumers} where controller_id = ${record.definitionId}`
            yield* database.sql`delete from ${controllerInstances} where controller_id = ${record.definitionId}`
          }
          pageToken = page.nextPageToken ?? undefined
        } while (pageToken)
      })
    )
  }
)
