import { Model } from "@company/model"
import { createApiDescription } from "@company/runtime"
import { createApiReference, createHttpApi } from "@company/runtime/effect/http"
import { Layer } from "effect"
import { OpenApi } from "effect/unstable/httpapi"

import { AuthorizationRepository } from "./authorization/authorization-repository.server"
import { Authorization } from "./authorization/authorization-service.server"
import { Database } from "./database/database.server"
import * as Postgres from "./database/postgres.server"
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

const repositoriesLayer = Layer.mergeAll(
  AuthorizationRepository.layer,
  CompanyRepository.layer,
  ContactRepository.layer,
  DealRepository.layer,
  GroupMembershipRepository.layer,
  GroupRepository.layer,
  InteractionRepository.layer,
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

const servicesLayer = Layer.mergeAll(
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

const applicationLayer = servicesLayer.pipe(
  Layer.provide(applicationDependenciesLayer)
)

const apiDescription = createApiDescription(Model)
const httpApi = createHttpApi(Model)
const openApiDocument = OpenApi.fromApi(httpApi)
const apiReference = createApiReference(httpApi, "/api/docs", {
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
  /** Requires only CurrentInvocation when executing governed operations. */
  layer: applicationLayer,
}

// Repositories, services, capability ports, provider adapters, and Effect
// layers are assembled here. Future object transports bind to these governed
// capabilities rather than implementing business behavior in route modules.
