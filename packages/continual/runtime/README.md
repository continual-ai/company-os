# @continual/runtime

Reusable, company-neutral machinery for describing and projecting a Company OS contract.

Company packages may use the portable root surface for definitions. Browser clients and
Effect-based server projections are separate public subpaths so consumers do not acquire unrelated
runtime assumptions.

```ts
import {
  defineInterface,
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
`update`, `delete`, and atomic `batchDelete` actions by default; set a write to `false` to disable
it, and declare additional actions for business behavior. Disabling `delete` also disables
`batchDelete`; it may be disabled independently when single-record deletion should remain.
Each normalized object's `actions` map contains its complete standard-plus-authored action catalog.
`defineModel` indexes those same maps alongside objects, links, interfaces, and Root; REST, clients,
and descriptions are projections of that contract rather than separate action definitions.

Definition metadata follows one naming rule: `kind` discriminates the category of a definition or
schema node, while `id` names that definition. Mixed-object runtime values use `objectType`; generic
targets that may name either an object or interface use `typeId`. Typed records do not repeat their
already-known type. SQL and other physical projections should preserve the distinction rather than
overloading a business property's name.

Every record has one canonical `id` and a set of opaque, globally qualified `aliases`, such as
`hubspot:portal_1:company:123`. Create accepts an alias array. On update, an array replaces the
complete set, while `{ add, remove }` applies an atomic delta; omission leaves aliases unchanged.
Aliases are alternate lookup keys, not company-defined object properties or a substitute for
canonical IDs.

Interfaces name polymorphic object roles such as `Party`, so links and other contracts can target
the role without choosing one concrete object type. Objects explicitly map any shared interface
properties when they implement one. A link gives both traversals a stable key, label, cardinality,
and target. For an FK-shaped link, `from` is always the singular reference-bearing side;
many-to-many is the only link shape with `many` on `from`. `defineModel` derives a typed
`${from.key}Id` property, so standard object creates, updates, filters, and reads use the same
reference without authors repeating it. Many traversals remain link collections rather than
embedded record fields. The singular `from` side that owns a reference must be an object.
The portable contract does not expose whether a backend uses a foreign key or join table; the
company backend owns that projection and its referential actions.

Object properties and operation values use the same portable schema vocabulary. Custom actions
are declared beside their primary object; their key supplies the action ID, their scope supplies a
canonical record `id` when needed, and `http` explicitly binds the public route:

```ts
const Lead = defineObject({
  id: "lead",
  collection: "leads",
  name: "Lead",
  parent: Root,
  pluralName: "Leads",
  properties: {
    name: schema.string({ label: "Name" }),
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

`list` is the one standard collection query. Simple pagination uses `GET /leads`; filters or
sorting use the equivalent `POST /leads/search` projection so the transport does not constrain the
portable request. Filters are typed by property kind, compose with `and`, `or`, and `not`, and
sorting is ordered and deterministic:

```ts
await client.leads.list({
  filter: {
    and: [
      { field: "status", operator: "eq", value: "new" },
      { field: "email", operator: "contains", value: "@example.com" },
    ],
  },
  sort: [
    { field: "createdAt", direction: "desc" },
    { field: "name", direction: "asc" },
  ],
  pageSize: 50,
})
```

The backend resolves fields through the declared object schema, validates values by semantic type,
uses parameterized predicates, appends an ID tie-breaker, and binds opaque page tokens to the exact
filter and sort. Add a custom action only for business behavior that standard object reads and
writes cannot express.

A writable property is required on create unless it is `nullable` or declares a `default`.
Nullable properties omitted on create become `null`; defaulted properties receive their declared
value. Output-only properties are supplied by the implementation and are never accepted as input.
This keeps nullability, persisted values, and create-time optionality distinct without a separate
configurable `required` flag.

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

The runtime does not impose an ORM, table layout, or migration system. A repository adapter must
preserve its own atomicity and hierarchy invariants. In particular, `batchDelete` must delete every
supplied record version in one transaction or leave all of them unchanged. `@continual/postgres`
provides the optional shared PostgreSQL implementation; company backends still own their adapter
choice, physical overrides, migrations, credentials, and service composition. These physical
choices never become part of the portable semantic model.
Repositories must also claim aliases atomically with the object write, enforce global uniqueness,
release removed aliases, and return aliases in deterministic order. A normalized alias table is the
expected relational projection; the public array is a record view, not a storage prescription.

The object service is the authoritative write boundary for definition-derived validation, defaults,
record metadata, immutable properties, create-under-parent authorization context, and optimistic
writes. This applies equally to calls from HTTP, MCP, agents, jobs, tests, and other services;
transport decoding is an additional protocol boundary, not the only validation layer. Company
services must add authorization and business behavior before a transport is bound. Repositories
receive validated values and own persistence translation, concurrency, and atomicity rather than
reimplementing semantic validation. Custom actions coordinate object services rather than reaching
through them to repositories.

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
