import { AcmeApi } from "@acme/api"
import { describeCompany } from "@continual/runtime"
import {
  compileCompanyHttpApi,
  makeCompanyApiReference,
  toOpenApiDocument,
} from "@continual/runtime/effect/http"

export const apiDescription = describeCompany(AcmeApi)
const companyHttpApi = compileCompanyHttpApi(AcmeApi)
export const openApiDocument = toOpenApiDocument(companyHttpApi)
export const apiReference = makeCompanyApiReference(companyHttpApi)

// Repositories, services, capability ports, provider adapters, and Effect
// layers are assembled here. Transport routes remain thin projections over
// the same governed company capabilities used by the Console.
