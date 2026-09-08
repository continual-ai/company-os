import { Layer } from "effect"

import { ModuleServices, moduleServiceLayer } from "#/app.server.ts"
import { BlobStorage } from "#/modules/assets/server/blob-storage.ts"
import { AuthorizationRepository } from "#/server/authorization/authorization-repository.ts"
import { Authorization } from "#/server/authorization/authorization-service.ts"
import type { Database } from "#/server/database/database.ts"
import { EventJournal } from "#/server/events/event-journal.ts"
import { Links } from "#/server/model/link-service.ts"
import { ModelImplementation } from "#/server/model/model-implementation.ts"
import { ObjectRepositories } from "#/server/model/object-repositories.ts"
import { RecordIdentifierResolver } from "#/server/model/record-identifier-resolver.ts"
import { PageTokens } from "#/server/page-tokens.ts"

export interface ApplicationServicesInfrastructure {
  readonly blobStorage?: Layer.Layer<BlobStorage, unknown>
  readonly pageTokens?: Layer.Layer<PageTokens, unknown>
  readonly database: Layer.Layer<Database, unknown>
}

/** The same governed business services for HTTP, MCP, trusted jobs, and development tools. */
export function makeApplicationServicesLayer({
  database,
  blobStorage: suppliedBlobStorage,
  pageTokens: suppliedPageTokens,
}: ApplicationServicesInfrastructure) {
  const pageTokens = suppliedPageTokens ?? PageTokens.layer
  const persistence = Layer.merge(database, pageTokens)
  const objectRepositories = ObjectRepositories.layer.pipe(
    Layer.provide(persistence)
  )
  const repositories = Layer.mergeAll(
    AuthorizationRepository.layer,
    objectRepositories
  ).pipe(Layer.provide(database))

  const authorization = Authorization.layer.pipe(Layer.provide(repositories))
  const recordIdentifierResolver = RecordIdentifierResolver.layer.pipe(
    Layer.provide(database)
  )
  const journal = EventJournal.layer.pipe(
    Layer.provide(Layer.mergeAll(database, authorization, pageTokens))
  )
  const applicationDependencies = Layer.mergeAll(
    journal,
    authorization,
    database,
    pageTokens,
    recordIdentifierResolver,
    repositories
  )
  const links = Links.layer.pipe(Layer.provide(applicationDependencies))
  const modelDependencies = Layer.merge(applicationDependencies, links)
  const specializedServices = moduleServiceLayer.pipe(
    Layer.provide(modelDependencies),
    Layer.provide(
      suppliedBlobStorage ?? BlobStorage.layer.pipe(Layer.provide(database))
    )
  )
  const moduleServices = ModuleServices.layer.pipe(
    Layer.provide(modelDependencies),
    Layer.provide(specializedServices)
  )
  const modelImplementation = ModelImplementation.layer.pipe(
    Layer.provide(modelDependencies),
    Layer.provide(moduleServices)
  )
  const governedServices = Layer.mergeAll(
    links,
    specializedServices,
    modelImplementation
  )
  return Layer.mergeAll(authorization, governedServices, journal)
}
