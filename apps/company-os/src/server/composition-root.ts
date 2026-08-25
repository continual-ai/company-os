import { Model } from "@company/model"
import { createApiDescription } from "@company/runtime"
import { createApiReference } from "@company/runtime/effect/http"
import { Layer } from "effect"
import { OpenApi } from "effect/unstable/httpapi"

import { ApiKeyAuthentication } from "./auth/api-key-authentication"
import { AuthSettings } from "./auth/auth-config"
import { AuthProtocol } from "./auth/auth-protocol"
import { Authentication } from "./auth/authentication"
import { IdentityBindingRepository } from "./auth/identity-binding-repository"
import { UserAuthentication } from "./auth/user-authentication"
import { AuthorizationRepository } from "./authorization/authorization-repository"
import { Authorization } from "./authorization/authorization-service"
import { CompanyApi } from "./company-api"
import { Database } from "./database/database"
import * as Postgres from "./database/postgres"
import { applicationHttpApi } from "./http-contract"
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

const databaseLayer = Database.layer.pipe(Layer.provide(Postgres.layer))
const authSettingsLayer = AuthSettings.layer
const authProtocolLayer = AuthProtocol.layer.pipe(
  Layer.provide(authSettingsLayer)
)
const readinessLayer = Readiness.layer.pipe(Layer.provide(databaseLayer))

const repositoriesLayer = Layer.mergeAll(
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
).pipe(Layer.provide(databaseLayer))

const authorizationLayer = Authorization.layer.pipe(
  Layer.provide(repositoriesLayer)
)

const coreObjectServicesLayer = Layer.mergeAll(
  ApiKeyService.layer,
  StandardObjectServices.layer,
  LeadService.layer,
  RoleAssignmentService.layer,
  ServiceAccountService.layer,
  UserService.layer
)

const applicationDependenciesLayer = Layer.mergeAll(
  authorizationLayer,
  databaseLayer,
  repositoriesLayer
)

const companyCoreServicesLayer = coreObjectServicesLayer.pipe(
  Layer.provide(applicationDependenciesLayer)
)

const invitationServiceLayer = InvitationService.layer.pipe(
  Layer.provide(companyCoreServicesLayer),
  Layer.provide(applicationDependenciesLayer)
)

const companyServicesLayer = Layer.merge(
  companyCoreServicesLayer,
  invitationServiceLayer
)

const userAuthenticationLayer = UserAuthentication.layer.pipe(
  Layer.provide(authSettingsLayer),
  Layer.provide(authProtocolLayer),
  Layer.provide(companyCoreServicesLayer),
  Layer.provide(repositoriesLayer),
  Layer.provide(databaseLayer)
)

const authenticationLayer = Authentication.layer.pipe(
  Layer.provide(
    Layer.mergeAll(
      userAuthenticationLayer,
      ApiKeyAuthentication.layer.pipe(Layer.provide(repositoriesLayer))
    )
  )
)

const companyApiLayer = CompanyApi.layer.pipe(
  Layer.provide(
    Layer.mergeAll(
      authenticationLayer,
      companyServicesLayer,
      userAuthenticationLayer
    )
  )
)

const applicationLayer = Layer.mergeAll(
  companyServicesLayer,
  authenticationLayer,
  authProtocolLayer,
  userAuthenticationLayer,
  companyApiLayer,
  readinessLayer
)

const apiDescription = createApiDescription(Model)
const openApiDocument = OpenApi.fromApi(applicationHttpApi)
const apiReference = createApiReference(applicationHttpApi, "/api/docs", {
  customCss: `
    .api-reference-toolbar {
      display: none !important;
    }
  `,
  hideDarkModeToggle: true,
  showSidebar: false,
})

export const application = {
  api: {
    description: apiDescription,
    document: openApiDocument,
    reference: apiReference,
  },
  layer: applicationLayer,
}

// Repositories, governed services, provider adapters, and executable
// transports are assembled here rather than in route modules.
