import { OpenApi } from "effect/unstable/httpapi"

import { EnabledModel } from "#/app.model.ts"
import { applicationHttpApi } from "#/app/http-api.ts"
import { makeApplicationLayer } from "#/app/server/application-layer.ts"
import * as Postgres from "#/app/server/database/postgres.ts"
import { describeModel } from "#/runtime/model/index.ts"

const applicationLayer = makeApplicationLayer({
  database: Postgres.databaseLayer,
  eventNotifications: Postgres.eventNotificationsLayer,
})

const modelDescription = describeModel(EnabledModel)
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
