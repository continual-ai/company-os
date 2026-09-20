import type { PgClient } from "@effect/sql-pg"
import { Layer } from "effect"

import type { ModelCatalog } from "#/runtime/model/index.ts"
import { ApplicationKeys } from "#/runtime/server/application-keys.ts"
import { Credentials } from "#/runtime/server/credentials.ts"
import { Database } from "#/runtime/server/database.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import { RecordRepositories } from "#/runtime/server/repository.ts"
import { RecordIdentifiers } from "#/runtime/server/storage/identifiers.ts"
import { Links } from "#/runtime/server/storage/link-store.ts"
import { RecordSecrets } from "#/runtime/server/storage/record-secrets.ts"
import { RecordStore } from "#/runtime/server/storage/record-store.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

/** Builds one execution foundation for HTTP, jobs, and isolated module tests. */
export function foundationLayer<E>(
  model: ModelCatalog,
  infrastructure: {
    readonly applicationKeys?: Layer.Layer<ApplicationKeys, E>
    readonly sql: Layer.Layer<PgClient.PgClient, E>
    readonly pageTokens?: Layer.Layer<PageTokens, E>
  }
) {
  const context = ModelContext.layer(model)
  const database = SqlDatabase.layer.pipe(
    Layer.provide(Layer.merge(context, infrastructure.sql))
  )
  const tokens = infrastructure.pageTokens ?? PageTokens.layer
  const secrets = infrastructure.applicationKeys
    ? RecordSecrets.layer.pipe(Layer.provide(infrastructure.applicationKeys))
    : RecordSecrets.layer.pipe(Layer.provide(ApplicationKeys.layer))
  const persistence = Layer.mergeAll(database, tokens, context, secrets)
  const identifiers = RecordIdentifiers.layer.pipe(Layer.provide(persistence))
  const repositories = RecordStore.layer.pipe(
    Layer.provide(Layer.merge(persistence, identifiers))
  )
  const base = Layer.mergeAll(persistence, identifiers, repositories)
  const journal = EventJournal.layer.pipe(Layer.provide(base))
  const links = Links.layer.pipe(Layer.provide(base))
  return Layer.mergeAll(
    base,
    Credentials.layer.pipe(Layer.provide(base)),
    journal,
    links,
    Database.layer.pipe(
      Layer.provideMerge(RecordRepositories.layer),
      Layer.provide(base)
    )
  )
}
