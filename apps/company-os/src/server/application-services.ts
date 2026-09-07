import { Layer } from "effect"

import { BlobStorage } from "@/modules/assets/server/blob-storage"

import { AuthorizationRepository } from "./authorization/authorization-repository"
import { Authorization } from "./authorization/authorization-service"
import type { Database } from "./database/database"
import { EventJournal } from "./events/event-journal"
import { Links } from "./model/link-service"
import { ModelImplementation } from "./model/model-implementation"
import { ObjectRepositories } from "./model/object-repositories"
import { RecordIdentifierResolver } from "./model/record-identifier-resolver"
import { ModuleServices, moduleServiceLayer } from "./module-services"
import { PageTokens } from "./page-tokens"

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
