import { AcmeApi } from "@acme/api"
import { createApiDescription } from "@continual/runtime"
import {
  createApiReference,
  createHttpApi,
} from "@continual/runtime/effect/http"
import { OpenApi } from "effect/unstable/httpapi"

export const apiDescription = createApiDescription(AcmeApi)
const httpApi = createHttpApi(AcmeApi)
export const openApiDocument = OpenApi.fromApi(httpApi)
export const apiReference = createApiReference(httpApi)

// Repositories, services, capability ports, provider adapters, and Effect
// layers are assembled here. Transport routes remain thin projections over
// the same governed company capabilities used by the Console.
