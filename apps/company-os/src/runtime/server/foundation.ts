import { Layer } from "effect"

import type { ModelCatalog } from "#/runtime/model/index.ts"
import { AuthorizationRepository } from "#/runtime/server/authorization/authorization-repository.ts"
import { Authorization } from "#/runtime/server/authorization/authorization-service.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { Links } from "#/runtime/server/model/link-service.ts"
import { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import { RecordIdentifierResolver } from "#/runtime/server/model/record-identifier-resolver.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import type { Database } from "#/runtime/server/storage/database.ts"

/** Builds one execution foundation for HTTP, jobs, and isolated module tests. */
export function foundationLayer<E>(
  model: ModelCatalog,
  infrastructure: {
    readonly database: Layer.Layer<Database, E>
    readonly pageTokens?: Layer.Layer<PageTokens, E>
  }
) {
  const context = ModelContext.layer(model)
  const database = infrastructure.database
  const tokens = infrastructure.pageTokens ?? PageTokens.layer
  const persistence = Layer.mergeAll(database, tokens, context)
  const identifiers = RecordIdentifierResolver.layer.pipe(
    Layer.provide(persistence)
  )
  const repositories = Layer.mergeAll(
    ObjectRepositories.layer,
    AuthorizationRepository.layer
  ).pipe(Layer.provide(Layer.merge(persistence, identifiers)))
  const authorization = Authorization.layer.pipe(
    Layer.provide(Layer.merge(persistence, repositories))
  )
  const base = Layer.mergeAll(
    persistence,
    identifiers,
    repositories,
    authorization
  )
  const journal = EventJournal.layer.pipe(Layer.provide(base))
  const links = Links.layer.pipe(Layer.provide(base))
  return Layer.mergeAll(base, journal, links)
}
