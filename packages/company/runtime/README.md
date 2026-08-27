# @company/runtime

Vendored, portable machinery for describing and projecting an operating model contract.

Workspace packages may use the portable root surface for definitions. Effect-based schema, HTTP, and
execution projections are separate public subpaths so consumers do not acquire unrelated runtime
assumptions.

```ts
import {
  defineInterface,
  defineLink,
  defineModel,
  defineModule,
  defineObject,
  defineRoot,
  type RecordIdOf,
  schema,
} from "@company/runtime"
import { Effect } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { HttpApiClient } from "effect/unstable/httpapi"
import { toEffectSchema } from "@company/runtime/effect"
import { createModelHttpApi } from "@company/runtime/effect/http"
import { createModelHttpHandlers } from "@company/runtime/effect/http"
import { createModelMcpHandler } from "@company/runtime/effect/mcp"
import { implementModel } from "@company/runtime/effect/model-implementation"
```

Every model defines one semantic root, and its objects form one explicit ownership hierarchy below
it:

```ts
const Identity = defineInterface({
  id: "identity",
  name: "Identity",
  pluralName: "Identities",
})

const Root = defineRoot({ id: "root", name: "Root" })

const User = defineObject({
  id: "user",
  collection: "users",
  name: "User",
  parent: Root,
  pluralName: "Users",
  properties: { name: schema.string({ label: "Name" }) },
  display: { title: "name" },
  implements: [{ interface: Identity }],
})

const Lead = defineObject({
  id: "lead",
  collection: "leads",
  name: "Lead",
  parent: Root,
  pluralName: "Leads",
  properties: { name: schema.string({ label: "Name" }) },
  display: { title: "name" },
})

const Model = defineModel({
  actor: Identity,
  modules: [
    defineModule({
      id: "sales",
      interfaces: [Identity],
      links: [],
      name: "Sales",
      objects: [User, Lead],
    }),
  ],
  name: "Example",
  root: Root,
})

export type IdentityId = RecordIdOf<typeof Model, typeof Identity>
```

The root is a singleton structural resource rather than an ordinary CRUD object. It may implement
marker interfaces, such as an authorization scope, but does not acquire configurable properties or
actions; model-specific configuration belongs in ordinary child objects.

Every object definition declares its parent type. Creates directly beneath the model root inherit
the application service's configured root record; nested creates supply a typed `parent`. This parent
is the canonical authorization and administrative containment edge; ordinary business
relationships remain links.
Every model also selects a registered interface as its `actor`. The IDs represented by that
interface become the exact `createdBy` and `updatedBy` types for every bound object record.
`RecordIdOf` derives similarly branded ID unions for any registered interface, object, or root, so
applications can publish names such as `IdentityId` and `PrincipalId` without defining parallel
brands.
Objects are readable through `get`, `list`, and `batchGet` as first-class model queries. They provide `create`,
`update`, `delete`, and atomic `batchDelete` actions by default; set a write to `false` to disable
it, and declare additional actions for business behavior. Disabling `delete` also disables
`batchDelete`; it may be disabled independently when single-record deletion should remain.
Each normalized object contains its complete standard-plus-authored action catalog. `defineModel`
indexes query and action maps alongside the model root, objects, links, and interfaces. A server
calls `implementModel(Model, services)` once to bind that catalog exhaustively to its governed
services. HTTP handlers, OpenAPI, typed clients, MCP tools, and descriptions project the binding;
there is no separate executor or protocol-specific business handler registry.

Declared failures use one transport-independent envelope: a canonical status, a stable
`UPPER_SNAKE_CASE` reason, a user-safe message, and typed details. Standard field and operation
violations carry Standard Schema-style property paths. Effect owns schema decoding and HTTP
projection, while application boundaries classify domain failures and storage adapters translate
only provider failures with stable semantic meaning. Unclassified infrastructure failures remain
internal rather than becoming accidental public contracts.

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

Public record-reference properties use the relationship noun without an `Id` suffix: `company`,
`principal`, `createdBy`, and `updatedBy`. Their value is a canonical record ID, and the stable noun
leaves room for a transport to expand that same property later. Definition-time validation rejects
record-reference properties that violate this rule. A record's own `id`,
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

Stable application-managed records may use readable well-known canonical IDs such as
`service_account_system`. These remain opaque application ABI: prefixes aid diagnostics but never
determine type, routing, or authorization. Aliases are alternate identifiers, especially identities
assigned by external systems; they are not required for well-known records.

Every returned record also carries the output-only `systemManaged` field. It identifies records
whose ordinary mutations are reserved for trusted system workflows; it does not grant access or
change hierarchy. The application authorization policy decides which invocation is trusted to
manage them.

Interfaces name polymorphic roles such as `Party`, so Links and other contracts can target a role
without choosing one concrete object type. An interface may be a marker capability with no
properties or a shared projection whose properties implementing objects map through an explicit
`propertyMapping`. A link defines complete `forward` and `reverse` traversals, each with its source,
target, local traversal `key`, label, and cardinality. Traversals remain separate APIs rather than
embedded record fields. Standard create may establish singular Links and canonical writable-many
Links atomically through its `links` envelope; non-writable reverse collections are not create
inputs. `one` means exactly one, `zeroOrOne` means optional singular, and `many` means zero or more.
The canonical writable traversal supplies idempotent `link` and eligible `unlink` Actions, while
both traversals supply a `list` Query. Re-linking a compatible singular endpoint replaces its prior
edge atomically, and deleting a target cannot orphan a required `one` traversal. The portable
contract does not expose storage orientation; the storage adapter derives its projection and
referential actions.

Use `parent` only for ownership and authorization hierarchy. Use a record-reference property for
directional inline state. Use a Link for a bidirectional edge without independent identity. Use an
Object when the relationship itself has attributes, lifecycle, history, or distinct policy. Do not
encode the same fact simultaneously as a property and a Link.

Object properties and action inputs and outputs use the same portable schema vocabulary. Custom
actions are declared beside their primary object; each `actions` entry key supplies the action ID,
and its scope supplies a typed record identifier when needed. The runtime derives one canonical
HTTP route instead of making domain authors repeat transport configuration:

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
    },
  },
})

const httpApi = createModelHttpApi(Model)
const client = Effect.runSync(
  HttpApiClient.make(httpApi).pipe(Effect.provide(FetchHttpClient.layer))
)

await Effect.runPromise(
  client.lead.createLead({ payload: { name: "New lead" } })
)
await Effect.runPromise(client.lead.qualifyLead({ params: { id: leadId } }))
```

`list` is the one standard collection query. Simple pagination uses `GET /leads`; filters or
sorting use the equivalent `POST /leads/search` projection so the transport does not constrain the
portable request. Object actions use `/leads/{id}/actions/qualify`; collection actions use
`/leads/actions/qualify`. Filters are typed by property kind, compose with `and`, `or`, and `not`, and
sorting is ordered and deterministic:

Every action is permission-governed. Applications may model universal caller sets as principals
when anonymous or authenticated callers need capabilities before they resolve to a durable actor;
the portable action contract does not introduce a parallel authorization mode.

```ts
await Effect.runPromise(
  client.lead.searchLeads({
    payload: {
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
    },
  })
)
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
application owns its physical schema, policies, and service composition. A model-derived repository
registry removes one Effect service declaration per ordinary object, while the model binding stays
an explicit, exhaustive map:

```ts
const make = Effect.gen(function* () {
  const repositories = yield* ObjectRepositories
  return implementModel(Model, {
    user: yield* makeObjectService(Model.objects.user, repositories.user),
    lead: yield* LeadService,
  })
})
```

The runtime does not impose an ORM, table layout, or migration system. A repository adapter must
preserve its own atomicity and hierarchy invariants. In particular, `batchDelete` must delete every
supplied record version in one transaction or leave all of them unchanged. `@company/postgres`
provides the optional shared PostgreSQL implementation; application backends still own their adapter
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
invocation supplies `CurrentInvocation` from a trusted boundary; the application service supplies its
root configuration. The runtime never reads either value from operation input. Application services
must add authorization and business behavior before a transport is bound. Repositories
receive validated values and own persistence translation, concurrency, and atomicity rather than
reimplementing semantic validation. Custom actions coordinate object services rather than reaching
through them to repositories.

Use one naming pattern in application backends: repositories own persistence, services own
governed application behavior, and `ModelImplementation` exhaustively binds the closed model to
those services. It validates and dispatches the binding but does not add another business execution
layer. HTTP and MCP servers are thin transport adapters over that binding. Routers partition the semantic input mechanically—such
as `id` in the path, delete `etag` in the query, and update values in the body—then merge those parts
back into the same service request object. They do not authorize, validate business rules, supply
audit actors, generate stored versions, or call repositories directly. There is no separate
controller layer unless a transport has substantial protocol-specific behavior worth naming.

## Owns

- Application-neutral object, link, and action definitions with type inference
- Mechanical descriptions or projections that preserve the source contract
- Reusable execution or transport behavior proven common across application slices

## Does not own

- Application nouns, policy, handlers, persistence, provider configuration, or UI
- A hosted-platform requirement
- Independent business implementations for each transport

Keep this package cohesive while its responsibilities remain small. Add a package or public subpath
only when a concrete consumer needs a meaningful dependency boundary.
