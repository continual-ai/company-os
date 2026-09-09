import { Context } from "effect"
import {
  type HttpApi,
  type HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi"

import { appMetadata } from "#/app.config.ts"
import { EnabledModel } from "#/app.model.ts"
import { createApplicationHttpApi } from "#/runtime/contract/application-http-api.ts"

/** Documents the default trusted ingress contract; verification stays in IdentityProvider. */
function documentIdentity<
  Id extends string,
  Groups extends HttpApiGroup.Constraint,
>(api: HttpApi.HttpApi<Id, Groups>) {
  const existing = Context.getOrUndefined(api.annotations, OpenApi.Transform)
  return api.annotate(OpenApi.Transform, (input) => {
    // SAFETY: the API-level transform receives the generated OpenAPI document.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const document = (existing ? existing(input) : input) as OpenApi.OpenAPISpec
    document.components.securitySchemes.runtimeIdentity = {
      type: "apiKey",
      in: "header",
      name: "x-continual-app-runtime-assertion",
      description:
        "Verified identity assertion supplied by the trusted hosting ingress. The standalone application's IdentityProvider owns verification and may be replaced. Local development supplies its own identity.",
    }
    for (const path of Object.values(document.paths)) {
      for (const method of ["get", "post", "patch", "put", "delete"] as const) {
        const operation = path[method]
        if (operation) operation.security = [{ runtimeIdentity: [] }]
      }
    }
    return document
  })
}

const contract = createApplicationHttpApi(EnabledModel, {
  id: appMetadata.id,
  version: appMetadata.version,
})

/** The one HTTP contract used by handlers, the browser client, OpenAPI, and tests. */
export const applicationHttpApi = documentIdentity(contract.api)

/** OpenAPI document for the exposed model; served to developers with the `develop` capability. */
export const openApiDocument = OpenApi.fromApi(applicationHttpApi)
