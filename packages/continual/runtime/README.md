# @continual/runtime

Reusable, company-neutral machinery for describing and projecting a Company OS contract.

Company packages may use the portable root surface for definitions. Browser clients and
Effect-based server projections are separate public subpaths so consumers do not acquire unrelated
runtime assumptions.

```ts
import {
  defineLink,
  defineModel,
  defineObject,
  Root,
  schema,
} from "@continual/runtime"
import { createClient } from "@continual/runtime/client"
import { Context, Effect, Layer } from "effect"
import { toEffectSchema } from "@continual/runtime/effect"
import { createHttpApi } from "@continual/runtime/effect/http"
import type { Repository } from "@continual/runtime/effect/object-repository"
import * as ObjectService from "@continual/runtime/effect/object-service"
```

Objects define typed records in one explicit ownership hierarchy rooted at the built-in `Root`.
Every object definition declares its parent type. Root-level creates inherit the authenticated
authority's Root; nested creates supply a typed `parentId`. This parent is the canonical
authorization and administrative containment edge; ordinary business relationships remain links.
Objects are readable through `get`, `list`, and `batchGet` by convention. They provide `create`,
`update`, and `delete` actions by default; set a write to `false` to disable it, and declare
additional actions for business behavior. `defineModel` indexes the objects, links, root, and
complete action catalog, and REST, clients, and descriptions are projections of that same contract.

Object properties and operation values use the same portable schema vocabulary. Custom actions
are declared beside their primary object; their key supplies the action ID, their scope supplies a
canonical object ID when needed, and `http` explicitly binds the public route:

```ts
const Lead = defineObject({
  id: "lead",
  collection: "leads",
  name: "Lead",
  parent: Root,
  pluralName: "Leads",
  properties: {
    name: schema.string({ label: "Name", required: true }),
  },
  display: { title: "name" },
  actions: {
    qualify: {
      scope: "object",
      name: "Qualify lead",
      description: "Qualifies a lead and creates its company and contact.",
      output: { qualified: schema.boolean() },
      http: { path: "/leads/{id}:qualify" },
    },
  },
})

await client.leads.create({ name: "New lead" })
await client.leads.qualify({ id: leadId })
```

The normalized action input includes `id`; REST binds it from `{id}`, while RPC and MCP expose the
same complete input object. OpenAPI is generated from the HTTP contract rather than authored as a
second description.

Server implementations derive standard object behavior without making Effect part of the portable
definition. `Repository` is the narrow persistence contract consumed by `ObjectService`; the
company backend owns its physical schema and repository implementation. Company code gives each
repository and service its stable Effect identity:

```ts
export class CompanyRepository extends Context.Service<CompanyRepository>()(
  "@acme/CompanyRepository",
  { make: makeCompanyRepository }
) {
  static readonly layer = Layer.effect(this, this.make)
}

const makeCompanyService = Effect.gen(function* () {
  const authorization = yield* Authorization
  const repository = yield* CompanyRepository

  return ObjectService.make(AcmeModel.objects.company, repository, {
    authorize: authorization.require,
  })
})

export class CompanyService extends Context.Service<CompanyService>()(
  "@acme/CompanyService",
  { make: makeCompanyService }
) {
  static readonly layer = Layer.effect(this, this.make)
}
```

The runtime does not impose an ORM, table layout, or migration system. A repository implementation
must preserve its own atomicity and hierarchy invariants. A company can use a shared object row and
a same-ID kind row, add typed object-specific queries, and extend storage with interface tables
without making those physical choices part of the portable semantic model.

The object service owns definition-derived validation, defaults, record metadata, immutable
properties, create-under-parent authorization context, and optimistic writes. Company services
must add authorization and business behavior before a transport is bound. Custom actions coordinate
object services rather than reaching through them to repositories.

## Owns

- Company-neutral object, link, and action definitions with type inference
- Mechanical descriptions or projections that preserve the source contract
- Reusable execution or transport behavior proven common across company slices

## Does not own

- Company nouns, policy, handlers, persistence, provider configuration, or UI
- A hosted-platform requirement
- Independent business implementations for each transport

Keep this package cohesive while its responsibilities remain small. Add a package or public subpath
only when a concrete consumer needs a meaningful dependency boundary.
