import { Layer } from "effect"

import { ApiKeyAuthentication } from "./auth/api-key-authentication"
import type { AuthSettings } from "./auth/auth-config"
import type { AuthProtocol } from "./auth/auth-protocol"
import { Authentication } from "./auth/authentication"
import { IdentityBindingRepository } from "./auth/identity-binding-repository"
import { UserAuthentication } from "./auth/user-authentication"
import { AuthorizationRepository } from "./authorization/authorization-repository"
import { Authorization } from "./authorization/authorization-service"
import { CompanyApi } from "./company-api"
import type { Database } from "./database/database"
import { ApiKeyRepository } from "./objects/api-key-repository"
import { ApiKeyService } from "./objects/api-key-service"
import { CompanyRepository } from "./objects/company-repository"
import { ContactRepository } from "./objects/contact-repository"
import { DealRepository } from "./objects/deal-repository"
import { GroupMembershipRepository } from "./objects/group-membership-repository"
import { GroupRepository } from "./objects/group-repository"
import { InteractionRepository } from "./objects/interaction-repository"
import { InvitationRepository } from "./objects/invitation-repository"
import { InvitationService } from "./objects/invitation-service"
import { LeadRepository } from "./objects/lead-repository"
import { LeadService } from "./objects/lead-service"
import { LineItemRepository } from "./objects/line-item-repository"
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
  readonly authProtocol: Layer.Layer<AuthProtocol, unknown>
  readonly authSettings: Layer.Layer<AuthSettings, unknown>
  readonly database: Layer.Layer<Database, unknown>
}

/** Assembles the application from replaceable infrastructure capabilities. */
export function makeApplicationLayer({
  authProtocol,
  authSettings,
  database,
}: ApplicationInfrastructure) {
  const repositories = Layer.mergeAll(
    ApiKeyRepository.layer,
    AuthorizationRepository.layer,
    IdentityBindingRepository.layer,
    CompanyRepository.layer,
    ContactRepository.layer,
    DealRepository.layer,
    GroupMembershipRepository.layer,
    GroupRepository.layer,
    InteractionRepository.layer,
    InvitationRepository.layer,
    LeadRepository.layer,
    LineItemRepository.layer,
    RoleAssignmentRepository.layer,
    RoleRepository.layer,
    ServiceAccountRepository.layer,
    UserRepository.layer
  ).pipe(Layer.provide(database))

  const authorization = Authorization.layer.pipe(Layer.provide(repositories))
  const applicationDependencies = Layer.mergeAll(
    authorization,
    database,
    repositories
  )
  const coreServices = Layer.mergeAll(
    ApiKeyService.layer,
    StandardObjectServices.layer,
    LeadService.layer,
    RoleAssignmentService.layer,
    ServiceAccountService.layer,
    UserService.layer
  ).pipe(Layer.provide(applicationDependencies))
  const invitationService = InvitationService.layer.pipe(
    Layer.provide(coreServices),
    Layer.provide(applicationDependencies)
  )
  const companyServices = Layer.merge(coreServices, invitationService)

  const userAuthentication = UserAuthentication.layer.pipe(
    Layer.provide(authSettings),
    Layer.provide(authProtocol),
    Layer.provide(coreServices),
    Layer.provide(repositories),
    Layer.provide(database)
  )
  const apiKeyAuthentication = ApiKeyAuthentication.layer.pipe(
    Layer.provide(repositories)
  )
  const authentication = Authentication.layer.pipe(
    Layer.provide(Layer.merge(userAuthentication, apiKeyAuthentication))
  )
  const companyApi = CompanyApi.layer.pipe(
    Layer.provide(
      Layer.mergeAll(authentication, companyServices, userAuthentication)
    )
  )
  const readiness = Readiness.layer.pipe(Layer.provide(database))

  return Layer.mergeAll(
    companyServices,
    authentication,
    authProtocol,
    userAuthentication,
    companyApi,
    readiness
  )
}
