import { describeModel } from "@company/runtime"
import { OpenApi } from "effect/unstable/httpapi"

import { Model } from "#/app.model.ts"
import { applicationHttpApi } from "#/http-api.ts"
import { makeApplicationLayer } from "#/server/application-layer.ts"
import * as Postgres from "#/server/database/postgres.ts"

const applicationLayer = makeApplicationLayer({
  database: Postgres.databaseLayer,
  eventNotifications: Postgres.eventNotificationsLayer,
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
