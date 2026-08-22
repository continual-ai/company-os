import { AcmeModel } from "@acme/api"
import { createApiDescription } from "@continual/runtime"
import {
  createApiReference,
  createHttpApi,
} from "@continual/runtime/effect/http"
import { Layer } from "effect"
import { OpenApi } from "effect/unstable/httpapi"

import { Database } from "./database/database.server"
import * as Postgres from "./database/postgres.server"
import { CompanyRepository } from "./objects/company-repository.server"
import { CompanyService } from "./objects/company-service.server"
import { ContactRepository } from "./objects/contact-repository.server"
import { ContactService } from "./objects/contact-service.server"
import { DealRepository } from "./objects/deal-repository.server"
import { DealService } from "./objects/deal-service.server"
import { InteractionRepository } from "./objects/interaction-repository.server"
import { InteractionService } from "./objects/interaction-service.server"
import { LeadRepository } from "./objects/lead-repository.server"
import { LeadService } from "./objects/lead-service.server"
import { LineItemRepository } from "./objects/line-item-repository.server"
import { LineItemService } from "./objects/line-item-service.server"

const objectRepositoriesLayer = Layer.mergeAll(
  CompanyRepository.layer,
  ContactRepository.layer,
  DealRepository.layer,
  InteractionRepository.layer,
  LeadRepository.layer,
  LineItemRepository.layer
).pipe(Layer.provide(Database.layer), Layer.provide(Postgres.layer))

const applicationLayer = Layer.mergeAll(
  CompanyService.layer,
  ContactService.layer,
  DealService.layer,
  InteractionService.layer,
  LeadService.layer,
  LineItemService.layer
).pipe(Layer.provide(objectRepositoriesLayer))

const apiDescription = createApiDescription(AcmeModel)
const httpApi = createHttpApi(AcmeModel)
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

export const companyOs = {
  api: {
    description: apiDescription,
    document: openApiDocument,
    reference: apiReference,
  },
  /** Supplied with Acme's authorization Layer before execution. */
  layer: applicationLayer,
}

// Repositories, services, capability ports, provider adapters, and Effect
// layers are assembled here. Future object transports bind to these governed
// capabilities rather than implementing business behavior in route modules.
