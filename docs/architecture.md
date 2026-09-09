# Architecture

Company OS is one application a company clones and owns. The kernel, every module, and the shell
live in `apps/company-os/src`. PostgreSQL is the authority for business records. People,
integrations, and agents reach the same governed operations through the React UI, the typed client,
HTTP and OpenAPI, and MCP.

## Three directories, one direction

| Directory  | Owns                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime/` | The kernel: portable model DSL, shared contracts, browser client, server execution and storage, UI foundation, test helpers, and the kernel modules `access/` and `assets/` |
| `modules/` | The business: one directory per capability, each shaped `model/ server/ ui/ seeds/`                                                                                         |
| `app/`     | The shell: layout, settings, sign-in, developer pages, client assembly, host adapters, migrations                                                                           |
| `routes/`  | TanStack Start file routes, generic over the model                                                                                                                          |

Dependencies point one way. `runtime/` imports nothing from `modules/`, `app/`, or `routes/`. A
module imports itself, other modules' `model/`, and `runtime/`. The shell imports everything. Model
code (`runtime/model`, `runtime/contract`, every `*/model/**`) imports no server, UI, client, React,
Node, or PostgreSQL code, so the composed model is browser-safe by construction. The oxlint plugin in
`tools/oxlint/company-os` enforces these rules and Vite import protection is the transitive check.

Upstream owns `runtime/`; customers change it last. `pnpm kernel:drift` lists kernel files a
checkout has changed relative to an upstream ref, and `pnpm upstream:merge` pulls upstream through
an ordinary Git merge.

## Four composition roots

- `app.model.ts` composes every module with `defineModel` into `Model`. This is the storage
  authority: `schema.sql` and the migrations project this model, whether or not a module is enabled.
- `app.config.ts` exports `enabledModules`. `enableModules(Model, enabledModules)` derives
  `EnabledModel`, failing at startup when the list is not closed under the dependencies the model
  graph implies (references, links, interface implementations) and naming the missing module.
- `app.server.ts` lists the custom operation contributions bound with `defineModuleServer`.
- `app.ui.ts` composes presentation contributions with `composeModelUi(EnabledModel, ...)`.

Persistence never sees the enabled list: services, storage, cascades, integrity checks, and the
event journal run on the complete `Model`, so a relationship into a disabled module still cascades
and journals when its visible side changes. Every exposure boundary receives `EnabledModel`: the
HTTP API and OpenAPI document, MCP tools, the semantic client, navigation, the generic routes,
record search, and capability checks. No component or route asks whether a module is enabled.
Disabling a module makes its operations not found and leaves its tables, data, and relationships in
place. Access and Assets are kernel modules and are always enabled. The list is
code; an environment variable never chooses the module set.

## Operations

The model declares Objects, Interfaces, Links, Events, Queries, and Actions. The kernel derives
standard CRUD, list filtering and cursor pagination, storage, HTTP, MCP tools, and default pages.
Custom Queries and Actions are named `Effect.fn` functions bound to their declared method through
`defineModuleServer`; they use the kernel services exported from `runtime/server/index.ts`:
`Database`, `Records`, `Links`, `Authorization`, `EventJournal`, `ModelContext`, and
`RecordIdentifierResolver`.

`Operations.run` in `runtime/server/invoke.ts` is the one invocation boundary for HTTP and MCP. It
supplies the current invocation, opens one transaction for an Action, normalizes API errors, and
collects the object types a write touched for cache invalidation. Custom operations still enforce
their own authorization and invariants, so calling them from a test or a seed gives the same
guarantees. `Database.transaction` joins an open transaction rather than nesting, so a standard
write inside a custom Action shares its atomicity and its event buffer. Queries are read-only and
filter authorized rows before aggregating.

Custom HTTP methods use colon suffixes such as `POST /api/v1/leads/{id}:convert`; lists accept
JSON-encoded filter and sort parameters on `GET /api/v1/<collection>`. Application-level
capabilities outside the model, such as event replay and record search, are separate groups on the
same HTTP contract in `app/http-api.ts`.

## Reads and changes

`app/app-client.ts` derives the semantic client and TanStack Query options from `EnabledModel`.
Feature code uses `useQuery(data.contact.list(...))` and `useMutation(data.contact.update())`;
router loaders preload the same options. Committed writes report affected object types in
`x-model-changes`; the shared cache applies canonical records by ordered etag and revalidates
affected lists, counts, and reports. Other browsers receive the same facts through the authorized
event feed. Details are in [client data](data.md) and [durable events](events.md).

## Identity and policy

An identity provider proves who is calling; Company OS decides what that principal may do. The
default provider in `app/server/auth/identity-provider.ts` verifies Continual runtime assertions
pinned to `CONTINUAL_URL`; `IDENTITY_PROVIDER=jwt` selects the JWT adapter, and development alone
supplies a local administrator. `makeApplicationLayer` in `app/server/application-layer.ts` accepts
a replacement provider layer. Roles, groups, scoped grants, record visibility, and audit attribution
belong to the Access module and are enforced on every operation, never inferred from a cached UI
capability check. See [deployment and identity](runbooks/deployment.md).

## Files

An Asset owns a durable file id, upload state, metadata, and protected bytes. `schema.image()` and
`schema.file()` store asset references. The default `BlobStorage` keeps bytes in PostgreSQL;
delivery authorizes access to the Asset on every request, completed content is immutable, and a
transactional reference index prevents deleting an asset that a record still uses. Attaching a file
does not change its ownership scope or grant another principal access to it.

## Optional apps

`templates/base` is the starter for a separate interface such as a portal. A copy imports
`company-os/model`, `company-os/metadata`, `company-os/ui/*`, and `company-os/styles.css` only and
calls the central app's governed API, forwarding the hosting platform's identity headers. It is not
a second business authority. See the [base starter](../templates/base/README.md).
