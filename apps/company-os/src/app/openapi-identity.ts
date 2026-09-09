import { Context } from "effect"
import {
  type HttpApi,
  type HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi"

/** Documents the default trusted ingress contract; verification stays in IdentityProvider. */
export function documentIdentity<
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
