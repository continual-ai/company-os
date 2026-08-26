import { Model } from "@company/model"
import { describeModel } from "@company/runtime"
import { createApiReference } from "@company/runtime/effect/http"
import { Layer } from "effect"
import { OpenApi } from "effect/unstable/httpapi"

import { applicationHttpApi } from "@/http-api"

import { makeApplicationLayer } from "./application-layer"
import { AuthSettings } from "./auth/auth-config"
import { Database } from "./database/database"
import * as Postgres from "./database/postgres"

const databaseLayer = Database.layer.pipe(Layer.provide(Postgres.layer))
const authSettingsLayer = AuthSettings.layer
const applicationLayer = makeApplicationLayer({
  authSettings: authSettingsLayer,
  database: databaseLayer,
})

const modelDescription = describeModel(Model)
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
  http: {
    document: openApiDocument,
    reference: apiReference,
  },
  layer: applicationLayer,
  model: {
    description: modelDescription,
  },
}

// Repositories, governed services, provider adapters, and executable
// transports are assembled here rather than in route modules.
