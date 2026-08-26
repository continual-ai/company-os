import { Layer } from "effect"

import type { AuthSettings } from "./auth/auth-config"
import { Authentication } from "./auth/authentication"
import { IdentityBindingRepository } from "./auth/identity-binding-repository"
import { IdentityProvider } from "./auth/identity-provider"
import { AuthorizationRepository } from "./authorization/authorization-repository"
import { Authorization } from "./authorization/authorization-service"
import { CompanyApi } from "./company-api"
import type { Database } from "./database/database"
import { AnonymousActorRepository } from "./objects/anonymous-actor-repository"
import { CompanyRepository } from "./objects/company-repository"
import { ContactRepository } from "./objects/contact-repository"
import { DealRepository } from "./objects/deal-repository"
import { GroupMembershipRepository } from "./objects/group-membership-repository"
import { GroupRepository } from "./objects/group-repository"
import { InteractionRepository } from "./objects/interaction-repository"
import { LeadRepository } from "./objects/lead-repository"
import { LeadService } from "./objects/lead-service"
import { LineItemRepository } from "./objects/line-item-repository"
import { PrincipalSetRepository } from "./objects/principal-set-repository"
import { RecordIdentifierResolver } from "./objects/record-identifier-resolver"
import { RoleAssignmentRepository } from "./objects/role-assignment-repository"
import { RoleAssignmentService } from "./objects/role-assignment-service"
import { RoleRepository } from "./objects/role-repository"
import { ServiceAccountRepository } from "./objects/service-account-repository"
import { ServiceAccountService } from "./objects/service-account-service"
import { StandardObjectServices } from "./objects/standard-object-services"
import { UserRepository } from "./objects/user-repository"
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
  const repositories = Layer.mergeAll(
    AnonymousActorRepository.layer,
    AuthorizationRepository.layer,
    IdentityBindingRepository.layer,
    CompanyRepository.layer,
    ContactRepository.layer,
    DealRepository.layer,
    GroupMembershipRepository.layer,
    GroupRepository.layer,
    InteractionRepository.layer,
    LeadRepository.layer,
    LineItemRepository.layer,
    PrincipalSetRepository.layer,
    RoleAssignmentRepository.layer,
    RoleRepository.layer,
    ServiceAccountRepository.layer,
    UserRepository.layer
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
  const coreServices = Layer.mergeAll(
    StandardObjectServices.layer,
    LeadService.layer,
    RoleAssignmentService.layer,
    ServiceAccountService.layer,
    UserService.layer
  ).pipe(Layer.provide(applicationDependencies))
  const identityProvider =
    suppliedIdentityProvider ??
    IdentityProvider.layer.pipe(Layer.provide(authSettings))
  const authentication = Authentication.layer.pipe(
    Layer.provide(authSettings),
    Layer.provide(identityProvider),
    Layer.provide(coreServices),
    Layer.provide(repositories),
    Layer.provide(database)
  )
  const companyApi = CompanyApi.layer.pipe(
    Layer.provide(Layer.mergeAll(authentication, authorization, coreServices))
  )
  const readiness = Readiness.layer.pipe(Layer.provide(database))

  return Layer.mergeAll(
    authSettings,
    coreServices,
    authentication,
    companyApi,
    readiness
  )
}
