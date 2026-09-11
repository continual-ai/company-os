import { Context, Effect, Schema } from "effect"
import {
  type HttpApi,
  type HttpApiEndpoint,
  type HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi"

type Api = HttpApi.HttpApi<string, HttpApiGroup.Constraint>

/** Effect beta.107 interprets literal colons differently in the router, client, and OpenAPI. */
export function customMethodPath(
  resource: `/${string}`,
  verb: string
): `/${string}` {
  return `${resource}::${verb}`
}

/** Synthetic client parameter for an escaped literal verb; never part of the public API. */
export function customMethodParameter<const T extends string>(verb: T) {
  return Schema.Literal(verb).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(verb))
  )
}

export function customMethodParams<
  const T extends string,
  P extends object = Record<never, never>,
>(verb: T, params?: P) {
  // SAFETY: the one computed key is the literal verb, with exactly that value.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { ...params, [verb]: verb } as P & { readonly [K in T]: T }
}

function projectApi(
  api: Api,
  project: (endpoint: HttpApiEndpoint.Top) => HttpApiEndpoint.Top | undefined
): Api {
  const groups = Object.fromEntries(
    Object.entries(api.groups).map(([id, definition]) => {
      // SAFETY: Effect's widened constraint hides the builder methods of these actual groups.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const group = definition as HttpApiGroup.Top
      class ProjectedGroup extends group {
        static override readonly endpoints = Object.fromEntries(
          Object.values(group.endpoints).flatMap((endpoint) => {
            const projected = project(endpoint)
            return projected === undefined
              ? []
              : [[projected.identifier, projected]]
          })
        )
      }
      return [id, ProjectedGroup]
    })
  )
  class ProjectedApi extends api {
    static override readonly groups = groups
  }
  return ProjectedApi
}

function withPath(
  endpoint: HttpApiEndpoint.Top,
  path: HttpApiEndpoint.Top["path"]
) {
  // Clone with the public builder before changing the adapter-owned path; retain endpoint methods.
  return Object.assign(endpoint.annotateMerge(Context.empty()), { path })
}

/** FindMyWay needs an explicit ID boundary before the literal colon. */
export function customMethodServerApi(api: Api): Api {
  return projectApi(api, (endpoint) =>
    withPath(endpoint, endpoint.path.replace("/:id::", "/:id([^/]+)::"))
  )
}

function restorePaths(document: OpenApi.OpenAPISpec): OpenApi.OpenAPISpec {
  return {
    ...document,
    paths: Object.fromEntries(
      Object.entries(document.paths).map(([path, operations]) => {
        const verb = path.match(/(?:\/~|:\{)(\w+)\}?$/)?.[1]
        const restored = path
          .replace(/\/~(\w+)$/, ":$1")
          .replace(/:\{(\w+)\}$/, ":$1")
        return [
          restored,
          Object.fromEntries(
            Object.entries(operations).map(([method, operation]) => [
              method,
              {
                ...operation,
                parameters: operation.parameters?.filter(
                  (parameter) =>
                    parameter.in !== "path" || parameter.name !== verb
                ),
              },
            ])
          ),
        ]
      })
    ),
  }
}

/** Compiles custom methods together, preserving group/API metadata and shared schema identities. */
export function customMethodApi<T extends Api>(api: T): T {
  const projected = projectApi(api, (endpoint) =>
    endpoint.path.includes("::")
      ? withPath(
          endpoint.annotate(OpenApi.Exclude, false),
          endpoint.path.replace(/::(\w+)$/, "/~$1")
        )
      : undefined
  )
  class DocumentApi extends projected {
    static override readonly annotations = api.annotations.pipe(
      Context.omit(OpenApi.Transform)
    )
  }
  const ContractApi = projectApi(api, (endpoint) =>
    endpoint.path.includes("::")
      ? endpoint.annotate(OpenApi.Exclude, true)
      : endpoint
  )
  const result = ContractApi.annotate(OpenApi.Transform, (document) => {
    // SAFETY: the transform receives Effect's complete OpenAPI document.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const spec = document as OpenApi.OpenAPISpec
    const custom = OpenApi.fromApi(DocumentApi)
    return restorePaths({
      ...spec,
      paths: { ...spec.paths, ...custom.paths },
      components: {
        ...spec.components,
        schemas: { ...spec.components.schemas, ...custom.components.schemas },
      },
    })
  })
  // SAFETY: projection changes documentation paths and annotations, preserving the runtime groups.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return result as T
}
