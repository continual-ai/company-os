import { Layer } from "effect"

import { ApplicationHttpServer } from "./application-http-server"
import { ApplicationMcpServer } from "./application-mcp-server"
import type { AuthSettings } from "./auth/auth-config"
import { Authentication } from "./auth/authentication"
import { IdentityBindingRepository } from "./auth/identity-binding-repository"
import { IdentityProvider } from "./auth/identity-provider"
import { AuthorizationRepository } from "./authorization/authorization-repository"
import { Authorization } from "./authorization/authorization-service"
import type { Database } from "./database/database"
import { ModelImplementation } from "./model-implementation"
import { LeadService } from "./objects/lead-service"
import { ObjectRepositories } from "./objects/object-repositories"
import { RecordIdentifierResolver } from "./objects/record-identifier-resolver"
import { RoleAssignmentRepository } from "./objects/role-assignment-repository"
import { RoleAssignmentService } from "./objects/role-assignment-service"
import { ServiceAccountService } from "./objects/service-account-service"
import { UserService } from "./objects/user-service"
import { Readiness } from "./readiness"

export interface ApplicationInfrastructure {
  readonly identityProvider?: Layer.Layer<IdentityProvider, unknown>
  readonly authSettings: Layer.Layer<AuthSettings, unknown>
  readonly database: Layer.Layer<Database, unknown>
}

/** Assembles the application from replaceable infrastructure capabilities. */
export function makeApplicationLayer({
  authSettings,
  database,
  identityProvider: suppliedIdentityProvider,
}: ApplicationInfrastructure) {
  const objectRepositories = ObjectRepositories.layer.pipe(
    Layer.provide(database)
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
    recordIdentifierResolver,
    repositories
  )
  const specializedServices = Layer.mergeAll(
    LeadService.layer,
    RoleAssignmentService.layer,
    ServiceAccountService.layer,
    UserService.layer
  ).pipe(Layer.provide(applicationDependencies))
  const modelImplementation = ModelImplementation.layer.pipe(
    Layer.provide(applicationDependencies),
    Layer.provide(specializedServices)
  )
  const governedServices = Layer.merge(specializedServices, modelImplementation)
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
  const httpServer = ApplicationHttpServer.layer.pipe(
    Layer.provide(
      Layer.mergeAll(authentication, authorization, governedServices)
    )
  )
  const mcpServer = ApplicationMcpServer.layer.pipe(
    Layer.provide(Layer.merge(authentication, governedServices))
  )
  const readiness = Readiness.layer.pipe(Layer.provide(database))

  return Layer.mergeAll(
    authSettings,
    governedServices,
    authentication,
    httpServer,
    mcpServer,
    readiness
  )
}
