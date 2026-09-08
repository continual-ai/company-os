# Company OS application

The central operating application and backend, built with TanStack Start. Business modules live
here alongside the UI and server that run them. The public `company-os/model` export is their
browser-safe contract; the private server binds it to permissions, transactions, HTTP, and MCP.

Start here to change a business operation. The reusable packages supply shared machinery, not the
app's business rules.

## App identity and configuration

`src/model-metadata.ts` supplies the shared name used by the starter apps. Customize the central
app's display name, branding, and home copy through `appConfig` in `src/customization/config.ts`.
`src/app-metadata.ts` supplies the generated protocol adapters with the configured app name.
`VITE_APP_URL` is the public origin used for canonical URLs and MCP origin checks; it is compiled
into the app at build time. The marketing-site template uses the same variable to link to this app.

Display names are independent of the stable `company-os` deployment key and `@company/*` package
namespace. An app does not need to represent a company or call itself an operating system.

## Run it

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://localhost:3002**. With PostgreSQL running, Turbo migrates the local database before
starting Vite. Development supplies a local administrator identity when no provider credential is
present. Inspect the model and generated interfaces at `/developer` and the OpenAPI document at
`/api/openapi`.

[`.env.example`](.env.example) supplies local defaults. Injected environment variables take precedence,
followed by app-local `.env.local`, repository `.env.local`, legacy app `.env`, and the example.
Only `VITE_` values enter browser code. Effect Config owns typed server configuration.

Production disables the local identity. The default build and authentication adapters target
Continual; using another host requires configuring the build target and a trusted identity adapter.
Read [deployment](../../docs/runbooks/deployment.md) for the exact boundary. Local development needs
no hosted platform.

## Follow a feature through the code

Start with [Engineering Issue](../../modules/engineering/src/model/issue.ts), a standard object with an assignee,
status, and attachments. It needs no custom server or route. Its
[UI contribution](../../modules/engineering/src/ui/index.ts) replaces the description editor with a multiline
field while retaining the standard form and validation.

Then read [Sales Lead](../../modules/sales/src/model/lead.ts), its
[conversion operation](../../modules/sales/src/server/convert-lead.ts), and its
[UI contribution](../../modules/sales/src/ui/index.ts). Conversion is a custom multi-object transaction exposed
through the same contract to every caller.

Module registration has three independent roots:

| Root                                     | Contribution                                                       |
| ---------------------------------------- | ------------------------------------------------------------------ |
| [`src/app.model.ts`](src/app.model.ts)   | Portable module definitions; exported as `company-os/model`        |
| [`src/app.server.ts`](src/app.server.ts) | Custom Effect services and their layers                            |
| [`src/app.ui.ts`](src/app.ui.ts)         | Module navigation, views, actions, tabs, editors, and custom pages |

Standard objects only need the model registration. The default services and generic routes derive
from it. A recursive import check keeps React, Effect, storage, and provider code out of the public
model, even though all three module entrypoints live together. See
[Building a module](../../docs/modules.md) for an end-to-end example.

## Source map

| Directory or file                            | Responsibility                                                  |
| -------------------------------------------- | --------------------------------------------------------------- |
| [`src/modules`](src/modules/README.md)       | Business definitions, custom operations, and specialized UI     |
| [`src/customization`](src/customization)     | Product identity, entry page, and authenticated home            |
| [`src/routes`](src/routes)                   | URL entrypoints and route loaders                               |
| [`src/ui/application`](src/ui/application)   | Shell, navigation, and session UI                               |
| [`src/ui/model`](src/ui/model)               | Shared collection, record, relationship, and field components   |
| [`src/ui/forms`](src/ui/forms)               | TanStack Form and schema/API error mapping                      |
| [`src/app-client.ts`](src/app-client.ts)     | The generated semantic client used by feature code              |
| [`src/data-client.ts`](src/data-client.ts)   | The request-scoped TanStack Query cache and invalidation        |
| [`src/server`](src/server)                   | Authentication, authorization, service assembly, and transports |
| [`src/server/database`](src/server/database) | App-owned storage schema, transactions, and migrations          |
| [`tools`](tools)                             | Database commands and checks for model/storage boundaries       |

Reusable primitives stay in `@company/runtime/ui`, portable definitions in `@company/runtime/model`, and the
PostgreSQL repository implementation in `@company/runtime/server/postgres`. Other apps may consume public
`company-os/model` and `company-os/metadata` exports; private services stay private.

## Read and write paths

The semantic client exports native query and mutation options. React uses `useQuery` and
`useMutation`; Router preloads the same queries and hydrates them after server rendering. The
Effect HTTP transport remains private. Reference labels and advisory IAM checks do not block
records. Standard actions and authorized SSE events share one cache reconciliation path.
Read [Data access](../../docs/data.md) for examples, cache ownership, and concurrency guarantees.

Identity verification is replaceable infrastructure. Company OS owns the resulting principals,
roles, groups, ownership scopes, and business policy. The
[architecture guide](../../docs/architecture.md) explains these boundaries and the current limits of
caching, authorization, and asset storage.

## Change persisted shape

Edit a module, then from the repository root:

```sh
pnpm --filter company-os db:generate
# Review schema.sql, then write and register the corresponding SQL migration.
pnpm dev
```

The generator derives the current `schema.sql` from the model; ordinary object additions require no manual
table registration. The template commits its minimal initial SQL. Customized apps with durable data preserve
the baseline and keep subsequent handwritten migrations as immutable application history.
Database tests compare their replayed schema with the declarations. Run `pnpm check`,
relevant tests, and `pnpm build` after routing or bundling changes. Read the
[database workflow](../../docs/runbooks/database.md) before resetting data or releasing a migration.

## Durable changes

The application owns a transactional event journal and an authorized cursor feed. Standard writes
record events automatically; custom Actions can append typed facts. Open browsers consume that
feed and refresh affected queries. Read [Durable events](../../docs/events.md) for the authoring
path, transaction guarantees, and the current polling and retention behavior.

## Composition

The default `app.model.ts` installs only Access and Assets. Add domains in that file, their custom
server bindings in `app.server.ts`, and UI in `app.ui.ts`. All are ordinary source-owned TypeScript.
See the [engineering/support walkthrough](../../docs/dogfooding.md) and
[database workflow](../../docs/runbooks/database.md). Full test fixtures live under `src/examples`.
