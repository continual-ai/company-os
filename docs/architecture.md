# Architecture

Company OS is one source-owned modular application. A domain lives in
`apps/company-os/src/modules/<domain>` or a source-owned package under `modules/<domain>`:
its portable definitions, server behavior, and specialized interface live together. PostgreSQL is the authority for business records. People,
integrations, and agents use the same governed operations through HTTP, the typed client, or MCP.

Use **app** for an application and its configuration, **model** for the shared domain
definitions, and **module** for a cohesive set of capabilities. Company OS is the starter's
product name; apps built from it do not need company-specific terminology or an "OS" suffix.
The `@company/*` package namespace and `apps/company-os` deployment key identify the foundation,
not the app's display name.

## Boundaries

| Source                             | Responsibility                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/company-os/src/modules`      | Editable business modules: Access, Sales, Marketing, Support, Engineering, Assets, and your additions |
| `apps/company-os/src/app.model.ts` | Explicit composition of the one closed model; public as `company-os/model`                            |
| `apps/company-os/src/server`       | Application assembly, identity, authorization, transactions, migrations, and transports               |
| `apps/company-os/src/ui/model`     | Default tables, forms, detail pages, and relationship navigation                                      |
| `packages/runtime`                 | Portable definitions and reusable Effect execution/HTTP/MCP machinery                                 |
| `packages/postgres`                | Server-only PostgreSQL projection and repository implementation                                       |
| `modules/notes`                    | Reusable Notes model, Markdown UI, and deterministic seed content                                     |
| `packages/ui`                      | Design tokens, base components, and reusable model UI contracts                                       |
| `templates/*`                      | Executable starters for optional interfaces over the central app                                      |

The model export composes browser-safe app and module-package definitions using portable `@company/runtime` APIs. A recursive import
check rejects Effect, UI, server code, and provider imports anywhere in that export's dependency
graph. The `company-os/metadata` export is equally browser-safe. Optional apps import those public
exports and call governed APIs; they cannot import private server modules. There is one migration
ledger and business authority, regardless of how many interfaces a company deploys.

Modules are copied and edited as ordinary source. Installing one means composing its model and,
when it has custom behavior, binding its operation functions at the application assembly. No dynamic
discovery, runtime unloading, service locator, or second plugin container is involved. Removing a
module in a customized app with durable data requires an explicit migration and policy review.
For this disposable template, update composition and regenerate the initial baseline.

Start with the [module authoring guide](modules.md). Standard object behavior is derived; custom
operation implementations are needed only for additional behavior or invariants. Generic routes give installed
objects a usable interface. Specialized workflows compose or replace those components. Each module can expose `model.ts`,
`server.ts`, and `ui.ts`. Their independent application roots keep the model browser-safe while
binding custom operations and UI once. UI contributions control navigation, saved views, actions,
record tabs/overview, property editors, and page replacements. Standard routes consume those
contributions; they contain no per-object presentation switches.

Larger modules give each object its `model.ts`, custom operations under `server/`, and presentation under `ui/`.
A small reusable module can use a model factory accepting the app root, as Notes does.
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
require Effect. Effect SQL supplies parameterized statements and transactions. The PostgreSQL adapter derives
physical storage and standard repositories from the portable model; custom operations share that client.

Custom operations default to named Effect functions. Services represent dependencies and cohesive
capabilities; repositories encapsulate persistence when useful. There is no mandatory service/repository
pair per object. SQL may live beside an operation, but authorization must constrain rows before an
aggregate and business writes must preserve model invariants. See [the operation guide](modules.md#add-a-query-or-action).

## Reads and changes

`src/app-client.ts` projects the portable model into native TanStack Query and mutation options.
Feature code uses `useQuery(data.contact.list(...))` and `useMutation(data.contact.update())`.
Router preloads the same options; SSR owns one cache per request and hydrates the browser cache.
The Effect HTTP client remains private transport infrastructure. There is no Atom request cache,
TanStack DB replica, or feature-specific query hook to learn.

Collections render their authorized list response immediately. Reference labels use bounded,
authorized list queries without blocking records. Relationship pages return full discriminated
records in one HTTP response. Advisory IAM checks are batched separately; the server always
authorizes reads and writes independently of those hints.

Transactions supply canonical results and `x-model-changes`. The shared cache reconciler cancels
older in-flight reads, updates existing appearances by ordered etag, removes tombstones, and
revalidates affected membership, ordering, counts, and custom reports. It does not attempt to run
server predicates or permissions locally. The journal streams authorized changes from other
clients through the same reconciliation path. Permissions changes clear cached records.

This is cached server state with realtime delivery and resumable catch-up. Writes require the
server; there is no offline write queue. Forms own their drafts and starting etag until submission.
Read [Data access](data.md) for the complete lifecycle and [Durable events](events.md) for journal
ordering, full payload visibility, authentication renewal, and notification failure recovery.

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

## Private imports

Each source package maps `#/*` to `./src/*` in `package.json`. Use `#/path/filename.ts`
(or `.tsx`) for all private imports, including files in the same folder. Cross-package imports
use declared package exports without source extensions. The development tooling
package has its source at the package root and maps `#/*` to `./*`.

Private imports name concrete files, so TypeScript, Node-based scripts, and app builds use the
same mapping without `tsconfig.paths`. Node 24.14+ on the 24.x line or Node 25.4+ is required.
The existing package-boundaries Oxlint rule enforces the import convention.
