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
  defineRoot,
  type RecordIdOf,
  schema,
} from "@continual/runtime"
import { createClient } from "@continual/runtime/client"
import { Context, Effect, Layer } from "effect"
import { toEffectSchema } from "@continual/runtime/effect"
import { createHttpApi } from "@continual/runtime/effect/http"
import type { Repository } from "@continual/runtime/effect/object-repository"
import * as ObjectService from "@continual/runtime/effect/object-service"
```

Every model defines one semantic root, and its objects form one explicit ownership hierarchy below
it. For example, a standalone Company OS can name that root `Platform`:

```ts
const Identity = defineInterface({
  id: "identity",
  name: "Identity",
  pluralName: "Identities",
})

const Platform = defineRoot({ id: "platform", name: "Platform" })

const User = defineObject({
  id: "user",
  collection: "users",
  name: "User",
  parent: Platform,
  pluralName: "Users",
  properties: { name: schema.string({ label: "Name" }) },
  display: { title: "name" },
  implements: [{ interface: Identity }],
})

const Lead = defineObject({
  id: "lead",
  collection: "leads",
  name: "Lead",
  parent: Platform,
  pluralName: "Leads",
  properties: { name: schema.string({ label: "Name" }) },
  display: { title: "name" },
})

const CompanyModel = defineModel({
  actor: Identity,
  id: "company",
  interfaces: [Identity],
  links: [],
  name: "Company",
  objects: [User, Lead],
  root: Platform,
})

export type IdentityId = RecordIdOf<typeof CompanyModel, typeof Identity>
```

The root is a singleton structural resource rather than an ordinary CRUD object. It may implement
marker interfaces, such as an authorization scope, but does not acquire configurable properties or
actions; model-specific configuration belongs in ordinary child objects.

Every object definition declares its parent type. Creates directly beneath the model root inherit
the company service's configured root record; nested creates supply a typed `parent`. This parent
is the canonical authorization and administrative containment edge; ordinary business
relationships remain links.
Every model also selects a registered interface as its `actor`. The IDs represented by that
interface become the exact `createdBy` and `updatedBy` types for every bound object record.
`RecordIdOf` derives similarly branded ID unions for any registered interface, object, or root, so
company APIs can publish names such as `IdentityId` and `PrincipalId` without defining parallel
brands.
Objects are readable through `get`, `list`, and `batchGet` by convention. They provide `create`,
`update`, `delete`, and atomic `batchDelete` actions by default; set a write to `false` to disable
it, and declare additional actions for business behavior. Disabling `delete` also disables
`batchDelete`; it may be disabled independently when single-record deletion should remain.
Each normalized object's `actions` map contains its complete standard-plus-authored action catalog.
`defineModel` indexes those same maps alongside the model root, objects, links, and interfaces;
REST, clients, and descriptions are projections of that contract rather than separate action
definitions.

An object's optional `uniqueBy` map names durable collection invariants using public field names.
For example, `{ email: ["email"] }` requires unique non-null email values, while
`{ membership: ["parent", "member"] }` defines a composite membership identity. Rules may include
the standard `parent` field and singular link properties; `defineModel` validates them after links
are bound. These rules identify object records; they do not restate relationship cardinality.
One-to-one uniqueness and duplicate many-to-many edges derive from the link definition itself, and
the model rejects a single-link `uniqueBy` rule. Storage adapters enforce both kinds of invariant
transactionally.

Definition metadata follows one naming rule: `kind` discriminates the category of a definition or
schema node, while `id` names that definition. Mixed-object runtime values use `objectType`; generic
targets that may name either an object or interface use `typeId`. Typed records do not repeat their
already-known type. SQL and other physical projections should preserve the distinction rather than
overloading a business property's name.

The remaining vocabulary is deliberately scoped. A **property** is schema-declared data on an
object, interface, or structured input. A **field** is a query, sort, or validation selector and may
name either a property or a standard record field such as `id` and `createdAt`. A **key** is a local
programmatic member name, such as a link traversal key; it is not another form of canonical `id`.

Public relationship properties use the relationship noun without an `Id` suffix: `company`,
`parent`, `createdBy`, and `updatedBy`. Their unexpanded value is a canonical record ID, and the
stable noun leaves room for a transport to expand that same property later. Definition-time
validation rejects record-reference properties that violate this rule. A record's own `id`,
plural selector inputs such as `ids`, and genuinely opaque identifiers such as `externalId` or
`assetId` retain the suffix. Internal authorization requests and physical storage columns use
explicit names such as `recordIds`, `companyId`, and `company_id` when distinguishing a scalar ID
from a loaded relation improves clarity.

Every record has one canonical `id` and a set of opaque, globally qualified `aliases`, such as
`hubspot:portal_1:company:123`. Create accepts an alias array. On update, an array replaces the
complete set, while `{ add, remove }` applies an atomic delta; omission leaves aliases unchanged.
`RecordIdentifier<T>` accepts either the typed canonical `RecordId<T>` or a `RecordAlias` wherever
a public input locates or references an existing record: `get`, `update`, `delete`, batch methods,
parents, singular links, and reference filters. Alias values must be qualified with a namespace and
contain `:`; canonical IDs cannot contain `:`, so transports can carry both as one unambiguous
string. Services resolve aliases in ordered batches and validate their expected object or interface
type before authorization. Stored references, repository calls, events, and returned records always
use the canonical ID.

Stable source-owned records may use readable well-known canonical IDs such as
`service_account_system`. These remain opaque application ABI: prefixes aid diagnostics but never
determine type, routing, or authorization. Aliases are alternate identifiers, especially identities
assigned by external systems; they are not required for well-known records.

Every returned record also carries the output-only `systemManaged` field. It identifies records
whose ordinary mutations are reserved for trusted system workflows; it does not grant access or
change hierarchy. The company-owned authorization policy decides which invocation is trusted to
manage them.

Interfaces name polymorphic roles such as `Party`, so links and other contracts can target a role
without choosing one concrete object type. An interface may be a marker capability with no
properties or a shared projection whose properties implementing objects map through an explicit
`propertyMapping`. A link defines complete `forward` and `reverse` traversals, each with its source,
target, local traversal `key`, label, and cardinality. `defineModel` derives a typed `${key}`
property for the singular traversal, so standard object creates, updates, filters, and reads use the
same reference without authors repeating it. Many traversals remain link collections rather than
embedded record fields. The portable contract does not expose which traversal owns a foreign key
or whether a backend uses a join table; the company backend derives that projection and its
referential actions.

Object properties and action inputs and outputs use the same portable schema vocabulary. Custom
actions are declared beside their primary object; each `actions` entry key supplies the action ID,
its scope supplies a typed record identifier when needed, and `http` explicitly binds the public
route:

```ts
const Lead = defineObject({
  id: "lead",
  collection: "leads",
  name: "Lead",
  parent: Platform,
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
sorting use the equivalent `POST /leads:search` projection so the transport does not constrain the
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
  { make: makeObjectRepository(AcmeModel.objects.company) }
) {
  static readonly layer = Layer.effect(this, this.make)
}

const makeCompanyService = Effect.gen(function* () {
  const authorization = yield* Authorization
  const repository = yield* CompanyRepository
  const resolveRecordAliases = yield* makeRecordAliasResolver

  return ObjectService.make(AcmeModel.objects.company, repository, {
    authorize: authorization.require,
    rootId: PLATFORM_ID,
    resolveRecordAliases,
    visibleWithin: authorization.visibleWithin,
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
choice, migrations, credentials, and service composition. These physical choices never become
part of the portable semantic model. Public clients, custom actions, and
governed services accept one schema-aligned request object. Repositories accept canonical IDs
directly for simple lookups, complete records for inserts and seed upserts, and named command objects
for versioned mutations; transport-specific argument shapes stop at the router boundary.
Repositories must also claim aliases atomically with the object write, enforce global uniqueness,
release removed aliases, and return aliases in deterministic order. A normalized alias table is the
expected relational projection; the public array is a record view, not a storage prescription.
The repository-only `upsert` contract converges complete stable-ID records for trusted seeds; it is
not automatically exposed as a public object action.

The object service is the authoritative boundary for record-identifier resolution,
definition-derived validation, authorization, defaults, caller-owned `metadata`, immutable
properties, audit fields, create-under-parent context, and optimistic writes. Update and delete
accept an optional `etag`; when supplied it is the caller's write precondition, and when omitted the
service uses the version it loaded while enforcing policy. The service supplies audit actors from
its invocation context. The repository compares the current `etag`, generates the stored successor,
uses its storage clock for `createdAt` and `updatedAt`, and persists those values in the same atomic
write. This applies equally to calls from HTTP, MCP, agents, jobs, tests, and other services.
Transport decoding is an additional protocol boundary, not the only validation layer. Each
invocation supplies `CurrentInvocation` from a trusted boundary; the company service supplies its
root configuration. The runtime never reads either value from operation input. Company services
must add authorization and business behavior before a transport is bound. Repositories
receive validated values and own persistence translation, concurrency, and atomicity rather than
reimplementing semantic validation. Custom actions coordinate object services rather than reaching
through them to repositories.

Use one naming pattern in company backends: `CompanyRepository` is the object-specific persistence
capability, `CompanyService` is the governed application capability, and an HTTP or MCP handler is a
thin transport adapter over that service. Routers partition the semantic input mechanically—such
as `id` in the path, delete `etag` in the query, and update values in the body—then merge those parts
back into the same service request object. They do not authorize, validate business rules, supply
audit identity, generate stored versions, or call repositories directly. There is no separate
controller layer unless a transport has substantial protocol-specific behavior worth naming.

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
