# @continual/runtime

The reusable kernel for defining and running a Company OS.

The runtime supplies company-neutral primitives and mechanical projections. Company packages use
it to describe their operating model; the private backend supplies the implementation. It never
imports `@acme/*`.

```ts
import {
  defineAction,
  defineApi,
  defineModule,
  defineObject,
  field,
  schema,
} from "@continual/runtime"
```

## Owns

- Semantic definition primitives and type inference
- Conventional object operations, base record types, and categorized API errors
- A portable, serializable schema and field vocabulary
- Stable file/image asset references and display metadata for generated interfaces
- Serializable contract descriptions
- Execution and transport machinery that is universal across companies
- Fetch-compatible HTTP, typed clients, OpenAPI, and MCP projections as real consumers require them

## Does not own

- Company nouns, policy, handlers, repositories, or UI
- Provider-specific configuration or a hosted-platform dependency
- A second business contract for each transport

Effect is an implementation projection rather than part of the public definition language:

```ts
import { toEffectObjectSchema, toEffectSchema } from "@continual/runtime/effect"
import {
  createApiReference,
  createHttpApi,
} from "@continual/runtime/effect/http"
```

The private server composition root uses Effect's own OpenAPI projection directly:

```ts
import { OpenApi } from "effect/unstable/httpapi"

const httpApi = createHttpApi(AcmeApi)
const openApiDocument = OpenApi.fromApi(httpApi)
const apiReference = createApiReference(httpApi)
```

Browser and SSR consumers construct an inferred client directly from the semantic contract:

```ts
import { AcmeApi } from "@acme/api"
import { createClient } from "@continual/runtime/client"

const client = createClient(AcmeApi, {
  baseUrl: "https://company.example/api/v1",
})

await client.companies.list({ pageSize: 25 })
await client.leads.qualify(leadId)
```

`createClient` materializes an ordinary object rather than generating source or adding module
namespaces. Collection identities group enabled standard operations and custom action verbs, so
the compiler can infer the complete surface from `AcmeApi`. OpenAPI `operationId` values remain
globally unique transport identifiers and do not dictate this client shape.

## Current state

The package implements schemas, fields, objects, conventional operation metadata, custom actions,
base records, categorized errors, modules, semantic APIs, a versioned description projection, and
Effect v4 Schema and `HttpApi` construction. The HTTP projection derives standard object routes,
AIP-style custom-action routes, an OpenAPI 3.1 document, and a Fetch-compatible Scalar reference
handler. The Fetch-based client derives resource-scoped methods directly from a live contract.
Endpoint execution, runtime response decoding, asset upload/download, and MCP remain to be built.

Objects enable `create`, `get`, `list`, `update`, `delete`, and `batchGet` by default. Standard
operations are runtime-defined methods, not authored actions. Use an explicit opt-out when one
does not exist:

```ts
defineObject({
  // ...
  operations: { batchGet: false, create: false, update: false, delete: false },
})
```

`ObjectRecord<T>` adds `id`, `etag`, `annotations`, `createdAt`, `createdById`, `updatedAt`, and
`updatedById`. `annotations` is a caller-managed string map accepted by create and update; the
other base fields are runtime-owned. Create and update inputs are derived from field behavior:

- Ordinary fields are accepted as input and returned as output.
- `outputOnly` fields are returned but omitted from create and update inputs.
- `immutable` fields may be set during creation. Updates may repeat their current value but cannot
  change it; handlers enforce that comparison against stored state.
- `required` means the caller must provide the field during creation.
- Fields are non-nullable by default. `nullable: true` opts into `T | null`.
- Omitted optional input uses `defaultValue` or the field kind's zero value. Textual fields use
  `""`; numbers use `0` when allowed by their constraints.
- Kinds without an honest zero value must be required, nullable, defaulted, or output-only.
- Update omission leaves a field unchanged. A zero value clears an ordinary field; `null` clears
  only a nullable field.

Every declared field is present in `ObjectRecord<T>` and no output property is `undefined`.
Definitions normalize every behavior to explicit metadata, and the Effect/OpenAPI projection emits
separate response, create, and update schemas. Write-only credentials belong in operation-specific
or action input schemas rather than object fields.

Semantic fields such as `email`, `domain`, `url`, `phone`, `date`, `timestamp`, `money`, `file`,
and `image` remain distinct in the portable definition. The Effect projection preserves their
validation and OpenAPI formats. Money uses a decimal string plus an uppercase currency code so
transport does not silently introduce floating-point rounding.

List operations use bounded `pageSize` plus an opaque `pageToken`. Responses always include
`nextPageToken`, using the empty string when there is no next page. Mutation routes accept an
optional `Idempotency-Key` header. `batchGet` accepts up to 100 IDs and returns records in request
order. The real handlers must enforce those documented semantics; the current HTTP layer is still
a contract projection.

`defineAction` is reserved for custom business verbs and accepts categorized `defineError`
declarations. HTTP routes reuse standard `UnauthenticatedError`, `PermissionDeniedError`,
`NotFoundError`, `ConflictError`, and `ValidationError` shapes. Validation details contain field
violations and global violations for direct form rendering. Company-specific errors should
describe real domain failures rather than restating generic transport conditions.

Keep this as one package while the kernel is small. Add browser, server, or platform subpath exports
when concrete code needs those boundaries; do not reserve empty packages.
