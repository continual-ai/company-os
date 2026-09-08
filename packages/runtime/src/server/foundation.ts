import { Layer } from "effect"

import type { ModelCatalog } from "#/model/index.ts"
import { AuthorizationRepository } from "#/server/authorization/authorization-repository.ts"
import { Authorization } from "#/server/authorization/authorization-service.ts"
import type { Database } from "#/server/database/database.ts"
import { EventJournal } from "#/server/events/event-journal.ts"
import { ModelContext } from "#/server/model-context.ts"
import { Links } from "#/server/model/link-service.ts"
import { ObjectRepositories } from "#/server/model/object-repositories.ts"
import { RecordIdentifierResolver } from "#/server/model/record-identifier-resolver.ts"
import { PageTokens } from "#/server/page-tokens.ts"

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
