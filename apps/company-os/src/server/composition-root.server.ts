import { Model } from "@company/model"
import { createApiDescription } from "@company/runtime"
import { createApiReference } from "@company/runtime/effect/http"
import { Layer } from "effect"
import { OpenApi } from "effect/unstable/httpapi"

import { ApiKeyAuthentication } from "./auth/api-key-authentication.server"
import { AuthSettings } from "./auth/auth-config.server"
import { AuthProtocol } from "./auth/auth-protocol.server"
import { Authentication } from "./auth/authentication.server"
import { IdentityBindingRepository } from "./auth/identity-binding-repository.server"
import { UserAuthentication } from "./auth/user-authentication.server"
import { AuthorizationRepository } from "./authorization/authorization-repository.server"
import { Authorization } from "./authorization/authorization-service.server"
import { CompanyApi } from "./company-api.server"
import { Database } from "./database/database.server"
import * as Postgres from "./database/postgres.server"
import { applicationHttpApi } from "./http-contract.server"
import { ApiKeyRepository } from "./objects/api-key-repository.server"
import { ApiKeyService } from "./objects/api-key-service.server"
import { CompanyRepository } from "./objects/company-repository.server"
import { CompanyService } from "./objects/company-service.server"
import { ContactRepository } from "./objects/contact-repository.server"
import { ContactService } from "./objects/contact-service.server"
import { DealRepository } from "./objects/deal-repository.server"
import { DealService } from "./objects/deal-service.server"
import { GroupMembershipRepository } from "./objects/group-membership-repository.server"
import { GroupMembershipService } from "./objects/group-membership-service.server"
import { GroupRepository } from "./objects/group-repository.server"
import { GroupService } from "./objects/group-service.server"
import { InteractionRepository } from "./objects/interaction-repository.server"
import { InteractionService } from "./objects/interaction-service.server"
import { InvitationRepository } from "./objects/invitation-repository.server"
import { InvitationService } from "./objects/invitation-service.server"
import { LeadRepository } from "./objects/lead-repository.server"
import { LeadService } from "./objects/lead-service.server"
import { LineItemRepository } from "./objects/line-item-repository.server"
import { LineItemService } from "./objects/line-item-service.server"
import { RoleAssignmentRepository } from "./objects/role-assignment-repository.server"
import { RoleAssignmentService } from "./objects/role-assignment-service.server"
import { RoleRepository } from "./objects/role-repository.server"
import { RoleService } from "./objects/role-service.server"
import { ServiceAccountRepository } from "./objects/service-account-repository.server"
import { ServiceAccountService } from "./objects/service-account-service.server"
import { UserRepository } from "./objects/user-repository.server"
import { UserService } from "./objects/user-service.server"

const databaseLayer = Database.layer.pipe(Layer.provide(Postgres.layer))
const authSettingsLayer = AuthSettings.layer
const authProtocolLayer = AuthProtocol.layer.pipe(
  Layer.provide(authSettingsLayer)
)

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
  CompanyService.layer,
  ContactService.layer,
  DealService.layer,
  GroupMembershipService.layer,
  GroupService.layer,
  InteractionService.layer,
  LeadService.layer,
  LineItemService.layer,
  RoleAssignmentService.layer,
  RoleService.layer,
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
  companyApiLayer
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
