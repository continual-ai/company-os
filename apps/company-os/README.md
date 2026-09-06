# Company OS application

The central operating application and backend, built with TanStack Start. Business modules live
here alongside the UI and server that run them. The public `company-os/model` export is their
browser-safe contract; the private server binds it to permissions, transactions, HTTP, and MCP.

Start here to change a business operation. The reusable packages supply shared machinery, not the
company's business rules.

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

Start with [Engineering Issue](src/modules/engineering/issue/model.ts), a standard object with an assignee,
status, and attachments. It needs no custom server or route. Its
[UI contribution](src/modules/engineering/ui.ts) replaces the description editor with a multiline
field while retaining the standard form and validation.

Then read [Sales Lead](src/modules/sales/lead/model.ts), its
[conversion operation](src/modules/sales/lead/server/convert.ts), and its
[UI contribution](src/modules/sales/ui.ts). Conversion is a custom multi-object transaction exposed
through the same contract to every caller.

Module registration has three independent roots:

| Root                                                             | Contribution                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`src/model.ts`](src/model.ts)                                   | Portable module definitions; exported as `company-os/model`        |
| [`src/server/module-services.ts`](src/server/module-services.ts) | Custom Effect services and their layers                            |
| [`src/app-ui.ts`](src/app-ui.ts)                                 | Module navigation, views, actions, tabs, editors, and custom pages |

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
| [`src/data-client.ts`](src/data-client.ts)   | The shared Effect Atom query cache and invalidation             |
| [`src/server`](src/server)                   | Authentication, authorization, service assembly, and transports |
| [`src/server/database`](src/server/database) | App-owned storage schema, transactions, and migrations          |
| [`tools`](tools)                             | Database commands and checks for model/storage boundaries       |

Reusable primitives stay in `@company/ui`, portable definitions in `@company/runtime`, and the
PostgreSQL repository implementation in `@company/postgres`. Other apps may consume public
`company-os/model` and `company-os/metadata` exports; private services stay private.

## Read and write paths

The semantic client returns Effects. `useModelQuery` observes cached reads; Router loaders preload
the same queries in the browser. Reference labels hydrate separately with bounded batch requests,
and advisory capability checks do not block the collection's read path. A custom React component
uses the same client rather than hand-writing HTTP requests.

Actions execute server-side authorization, validation, and transactions. Repositories report which
object types changed, and the response invalidates affected cached reads. UI code does not maintain
custom-action write sets or issue its own post-write reloads. Query and mutation examples are in the
[module guide](../../docs/modules.md#read-and-write-data).

Identity verification is replaceable infrastructure. Company OS owns the resulting principals,
roles, groups, ownership scopes, and business policy. The
[architecture guide](../../docs/architecture.md) explains these boundaries and the current limits of
caching, authorization, and asset storage.

## Change persisted shape

Edit a module, then from the repository root:

```sh
pnpm --filter company-os db:generate
# Review the generated migration before applying it.
pnpm dev
```

The generator exposes all model tables to Drizzle Kit; ordinary object additions require no manual
table registration. Migrations and snapshots are committed application history. Run `pnpm check`,
relevant tests, and `pnpm build` after routing or bundling changes. Read the
[database workflow](../../docs/runbooks/database.md) before resetting data or releasing a migration.

## Durable changes

The application owns a transactional event journal and an authorized cursor feed. Standard writes
record events automatically; custom Actions can append typed facts. Open browsers consume that
feed and refresh affected queries. Read [Durable events](../../docs/events.md) for the authoring
path, transaction guarantees, and the current polling and retention behavior.
