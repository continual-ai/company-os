import { Layer } from "effect"

import type { AuthSettings } from "./auth/auth-config"
import { Authentication } from "./auth/authentication"
import { IdentityBindingRepository } from "./auth/identity-binding-repository"
import { IdentityProvider } from "./auth/identity-provider"
import { AuthorizationRepository } from "./authorization/authorization-repository"
import { Authorization } from "./authorization/authorization-service"
import type { Database } from "./database/database"
import { Links } from "./model/link-service"
import { ModelImplementation } from "./model/model-implementation"
import { ObjectRepositories } from "./model/object-repositories"
import { RecordIdentifierResolver } from "./model/record-identifier-resolver"
import { RoleAssignmentRepository } from "./modules/access/role-assignment-repository"
import { RoleAssignmentService } from "./modules/access/role-assignment-service"
import { ServiceAccountService } from "./modules/access/service-account-service"
import { UserService } from "./modules/access/user-service"
import { LeadService } from "./modules/sales/lead-service"
import { PageTokens } from "./page-tokens"
import { Readiness } from "./readiness"
import { HttpTransport } from "./transport/http-transport"
import { McpTransport } from "./transport/mcp-transport"

export interface ApplicationInfrastructure {
  readonly identityProvider?: Layer.Layer<IdentityProvider, unknown>
  readonly pageTokens?: Layer.Layer<PageTokens, unknown>
  readonly authSettings: Layer.Layer<AuthSettings, unknown>
  readonly database: Layer.Layer<Database, unknown>
}

/** Assembles the application from replaceable infrastructure capabilities. */
export function makeApplicationLayer({
  authSettings,
  database,
  identityProvider: suppliedIdentityProvider,
  pageTokens: suppliedPageTokens,
}: ApplicationInfrastructure) {
  const pageTokens = suppliedPageTokens ?? PageTokens.layer
  const persistence = Layer.merge(database, pageTokens)
  const objectRepositories = ObjectRepositories.layer.pipe(
    Layer.provide(persistence)
  )
  const roleAssignmentRepository = RoleAssignmentRepository.layer.pipe(
    Layer.provide(database),
    Layer.provide(objectRepositories)
  )
  const repositories = Layer.mergeAll(
    AuthorizationRepository.layer,
    IdentityBindingRepository.layer,
    objectRepositories,
    roleAssignmentRepository
  ).pipe(Layer.provide(database))

  const authorization = Authorization.layer.pipe(Layer.provide(repositories))
  const recordIdentifierResolver = RecordIdentifierResolver.layer.pipe(
    Layer.provide(database)
  )
  const applicationDependencies = Layer.mergeAll(
    authorization,
    database,
    pageTokens,
    recordIdentifierResolver,
    repositories
  )
  const links = Links.layer.pipe(Layer.provide(applicationDependencies))
  const modelDependencies = Layer.merge(applicationDependencies, links)
  const specializedServices = Layer.mergeAll(
    LeadService.layer,
    RoleAssignmentService.layer,
    ServiceAccountService.layer,
    UserService.layer
  ).pipe(Layer.provide(modelDependencies))
  const modelImplementation = ModelImplementation.layer.pipe(
    Layer.provide(modelDependencies),
    Layer.provide(specializedServices)
  )
  const governedServices = Layer.mergeAll(
    links,
    specializedServices,
    modelImplementation
  )
  const identityProvider =
    suppliedIdentityProvider ??
    IdentityProvider.layer.pipe(Layer.provide(authSettings))
  const authentication = Authentication.layer.pipe(
    Layer.provide(authSettings),
    Layer.provide(identityProvider),
    Layer.provide(governedServices),
    Layer.provide(repositories),
    Layer.provide(database)
  )
  const httpTransport = HttpTransport.layer.pipe(
    Layer.provide(
      Layer.mergeAll(authentication, authorization, governedServices)
    )
  )
  const mcpTransport = McpTransport.layer.pipe(
    Layer.provide(Layer.merge(authentication, governedServices))
  )
  const readiness = Readiness.layer.pipe(Layer.provide(database))

  return Layer.mergeAll(
    authSettings,
    authorization,
    governedServices,
    authentication,
    httpTransport,
    mcpTransport,
    readiness
  )
}
