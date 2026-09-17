import { Effect } from "effect"

import { type PageToken } from "#/runtime/model/index.ts"
import {
  Connector,
  connectorAlias,
} from "#/runtime/platform/model/connector.ts"
import { moduleAlias } from "#/runtime/platform/model/module-setting.ts"
import { Database } from "#/runtime/server/database.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"

/** Preserve configured connections if a provider is removed from the deployed code. */
export const syncConnectors = Effect.fn("platform.syncConnectors")(
  function* () {
    const { model } = yield* ModelContext
    if (!model.objects[Connector.id]) return
    const database = yield* Database
    const connectors = database.repository(Connector)
    yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* database.sql`select pg_advisory_xact_lock(hashtext('company_os_connector_registry'))`
        const registered = new Set<string>()
        for (const module of Object.values(model.modules)) {
          for (const definition of module.connectors) {
            const record = yield* connectors.upsert({
              alias: connectorAlias(definition.id),
              values: {
                definitionId: definition.id,
                name: definition.name,
                description: definition.description,
                authentication: definition.authentication,
                available: true,
              },
              links: { module: moduleAlias(module.id) },
            })
            registered.add(record.id)
          }
        }
        let pageToken: PageToken | undefined
        do {
          const page = yield* connectors.list({
            pageSize: 100,
            ...(pageToken ? { pageToken } : {}),
          })
          for (const record of page.items) {
            if (!registered.has(record.id) && record.available)
              yield* connectors.update({ id: record.id, available: false })
          }
          pageToken = page.nextPageToken ?? undefined
        } while (pageToken)
      })
    )
  }
)
