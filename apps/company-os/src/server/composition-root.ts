import { Model } from "@company/model"
import { describeModel } from "@company/runtime"
import { OpenApi } from "effect/unstable/httpapi"

import { applicationHttpApi } from "@/http-api"

import { makeApplicationLayer } from "./application-layer"
import { AuthSettings } from "./auth/auth-config"
import * as Postgres from "./database/postgres"

const authSettingsLayer = AuthSettings.layer
const applicationLayer = makeApplicationLayer({
  authSettings: authSettingsLayer,
  database: Postgres.databaseLayer,
})

const modelDescription = describeModel(Model)
const openApiDocument = OpenApi.fromApi(applicationHttpApi)

export const application = {
  http: {
    document: openApiDocument,
  },
  layer: applicationLayer,
  model: {
    description: modelDescription,
  },
}

// Repositories, governed services, provider adapters, and executable
// transports are assembled here rather than in route modules.
