# Architecture

Company OS is one source-owned modular application. A domain lives in
`apps/company-os/src/modules/<domain>`: its portable definitions, private server behavior, and
specialized interface live together. PostgreSQL is the authority for business records. People,
integrations, and agents use the same governed operations through HTTP, the typed client, or MCP.

## Boundaries

| Source                         | Responsibility                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `apps/company-os/src/modules`  | Editable business modules: Access, Sales, Assets, Engineering, and your additions       |
| `apps/company-os/src/model.ts` | Explicit composition of the one closed model; public as `company-os/model`              |
| `apps/company-os/src/server`   | Application assembly, identity, authorization, transactions, migrations, and transports |
| `apps/company-os/src/ui/model` | Default tables, forms, detail pages, and relationship navigation                        |
| `packages/runtime`             | Portable definitions and reusable Effect execution/HTTP/MCP machinery                   |
| `packages/postgres`            | Server-only PostgreSQL projection and repository implementation                         |
| `packages/ui`                  | Source-owned presentation primitives and design tokens                                  |
| `templates/*`                  | Executable starters for optional interfaces over the central app                        |

The model export may depend only on portable `@company/runtime` definitions. A recursive import
check rejects Effect, UI, server code, and provider imports anywhere in that export's dependency
graph. The `company-os/metadata` export is equally browser-safe. Optional apps import those public
exports and call governed APIs; they cannot import private server modules. There is one migration
ledger and business authority, regardless of how many interfaces a company deploys.

Modules are copied and edited as ordinary source. Installing one means composing its model and,
when it has custom behavior, binding its operation functions at the application assembly. No dynamic
discovery, runtime unloading, service locator, or second plugin container is involved. Removing a
module that already owns data requires an explicit migration and policy review.

Start with the [module authoring guide](modules.md). Standard object behavior is derived; custom
operation implementations are needed only for additional behavior or invariants. Generic routes give installed
objects a usable interface. Specialized workflows compose or replace those components. Each module can expose `model.ts`,
`server.ts`, and `ui.ts`. Their independent application roots keep the model browser-safe while
binding custom operations and UI once. UI contributions control navigation, saved views, actions,
record tabs/overview, property editors, and page replacements. Standard routes consume those
contributions; they contain no per-object presentation switches.

Each object owns its `model.ts`, custom operations under `server/`, and presentation under `ui/`.
`ui/config.ts` registers components; module-level entrypoints compose them. Page and form assembly
resolve UI configuration and pass explicit props to standard components. Additive extensions
(`additionalTabs`, toolbar controls, Action placements) and replacements (pages, overview, field
editors) have distinct names. A custom workflow can own an ordinary React page and TanStack route;
it continues to use the semantic client and governed server operations.

## Model and operations

Objects are durable identities. References express directional state; Links express a shared
bidirectional relationship without independent identity; association Objects carry their own
attributes, lifecycle, history, or policy. `parent` alone defines ownership and authorization
inheritance. See [modeling](modeling.md).

Queries and Actions stay distinct because their execution guarantees differ. They share schema,
error, identity, and transport machinery. Queries read authorized state. Actions perform governed
transitions; standard writes and custom business transitions use the same repositories and
transaction boundary. HTTP custom methods use literal colon suffixes, such as
`/api/v1/companies:batchGet` and `/api/v1/leads/{id}:convert`.
`GET /api/v1/companies` supports filtering, sorting, and cursor pagination. Structured filters and
sort arrays are JSON-encoded query parameters by the generated codec. There is no separate search
operation. Lists and hydration return ordinary resources, without BASIC/FULL views or permission envelopes.

Effect v4 services use `Context.Service(..., { make })`, named `Effect.fn` operations, and static
`.layer` implementations. Acquire dependencies in `make`, compose layers at the application
boundary, and use typed failures for expected business outcomes. Portable model definitions do not
require Effect. Drizzle implements ordinary typed SQL and transactions over the Effect PostgreSQL
client; replacing it would not improve the domain boundary by itself.

Custom operations default to named Effect functions. Services represent dependencies and cohesive
capabilities; repositories encapsulate persistence when useful. There is no mandatory service/repository
pair per object. SQL may live beside an operation, but authorization must constrain rows before an
aggregate and business writes must preserve model invariants. See [the operation guide](modules.md#add-a-query-or-action).

## Reads and changes

`src/app-client.ts` is the one semantic client assembly. Its generated Queries use an Effect Atom
registry keyed by object type, operation, and request. Feature code calls the same client for
preloading and rendering. `useModelQuery` observes that same registry; derived queries track
reference hydration through Effect Atom dependencies. Hooks own interaction state
such as selected pages and unsaved form edits, not copies of remote records or request lifecycles.
The UI adapter only bridges dynamic model components to that typed client. Cache entries have a bounded idle lifetime, reset when the
browser identity changes, and revalidate on window focus.

Collection loaders preload the selected view's exact filter and sort. Tables render after the
list response. Reference labels hydrate with bounded `:batchGet` calls, with authorized
filtered listing as a fallback for unavailable references. Advisory IAM checks run separately for
controls. Relationship pages hydrate their bounded target set on the server, grouped by object type,
and return complete discriminated records in one HTTP response. Collections do not perform per-row permission checks; an opened record may check its
available actions in one batch. Server authorization still applies to every read and write.

Repositories record the object types actually written inside the current transaction. Link writes
include both endpoint types. Deletion locks source records and captures affected Link endpoints
before PostgreSQL cascades remove them, including batch deletion. The HTTP response carries `x-model-changes` only after a successful
Action; rolled-back transactions and caught savepoint failures contribute no changes. The client
refreshes affected cached Queries and visible collections, including writes performed by custom
Actions. Standard create/edit/Link flows do not issue a second manual refresh after successful
writes. Feature code never lists the authoritative dependencies of a mutation. Custom SQL writes
must append a declared event covering their affected records inside the same transaction.

This is cached server state, not an offline database or a live sync engine. Business collection
preloading currently runs in the browser; server rendering does not serialize authenticated
business records. Writes from other clients are discovered through the authorized event feed while the app is visible;
the consumer resumes after network interruption and resets its cache when read scopes change.
See [Durable events](events.md) for transaction, replay, and visibility guarantees. TanStack
DB remains a possible future replacement if local relational joins, optimistic transactions, or
live sync justify translating its subset requests to the authorized cursor API. Do not add a
second competing record store alongside this path.

## Identity and policy

The default deployed authentication adapter retains Continual's proxy/runtime assertion contract.
`CONTINUAL_URL` pins the verifier; a forwarded origin cannot select a different authority. The app
verifies the assertion remotely, resolves a local identity binding, and constructs invocation
context. Concurrent consumers of the same request headers share identity resolution. Development
alone supplies a local identity without an external provider. No app mints a platform identity.

Continual owns credential verification, login/session lifecycle, and deployment access. Company OS
owns its principals, roles, groups, business permissions, ownership scopes, query visibility, and
audit attribution. Hosting access does not imply business administrator access. First-administrator
bootstrap requires `AUTH_BOOTSTRAP_ISSUER` and `AUTH_BOOTSTRAP_SUBJECT`; ordinary provisioning defaults
to no role unless `AUTH_DEFAULT_ROLE=operator` is explicitly chosen. Existing grants are preserved.

Current fine-grained authorization is role grants scoped to an ownership hierarchy, including group
membership. Reads constrain results to authorized scopes; mutations enforce policy again on the
server. Arbitrary relationship-based policy expressions and richer workload/delegated identity
remain separate future work. A replacement `IdentityProvider.layer` can integrate another trusted
login boundary without changing business policy or domain services.

## Files

An Asset owns a durable file ID, upload state, metadata, and protected bytes. `schema.image()` and
`schema.file()` store an asset reference; image alternative text belongs to that particular usage.
Attachment fields are arrays of file references. The shared editor reserves an asset, uploads with
progress/cancellation, completes verification, and only then submits the reference with the form.
Asset-field traversal is compiled at service/repository construction. Objects without asset fields
have no asset-index persistence work.

The default BlobStorage layer uses PostgreSQL, supports files up to 25 MB and image dimensions up to
40 megapixels, and needs no bucket or hosting change. Binary file types are detected from signatures; PNG/JPEG/WebP/GIF dimensions are checked.
Text uploads are decoded as UTF-8. Non-image files are served as downloads with a conservative
content type, while metadata retains their detected type for file-field constraints. This is not a
malware scanner or image transformation service. Delivery authorizes access to the Asset on every
request. Completed content cannot be overwritten. Field writes validate availability, type/size
constraints, and read permission; a transactional reference index prevents deletion while in use.

An Asset has its own ownership scope. The default editor uses the form's selected parent scope;
attaching a file does not grant another principal access to it or automatically change its scope.
Workflows with narrower sharing must choose an appropriate asset scope explicitly.

Cancellation attempts to delete its reserved asset. Disconnected clients can leave pending assets,
which remain visible and deletable in Assets. Removing a file field unlinks that usage; it does not
delete a potentially shared asset. Old placeholder asset IDs from earlier forks require re-upload.
`makeApplicationLayer` accepts a replacement BlobStorage layer; any remote implementation must also
address retention and deletion of external bytes rather than assuming PostgreSQL foreign keys
will remove them.
