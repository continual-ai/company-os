<div align="center">
  <h1>Company OS</h1>
  <p><strong>Build the software your company runs on.</strong></p>
  <p>
    An editable TypeScript foundation for business operations.<br />
    Your records, rules, and workflows. One application for people, integrations, and agents.
  </p>
  <p><strong>Early preview</strong> · TypeScript · Effect v4 · React · PostgreSQL</p>
  <p>
    <a href="#quick-start">Quick start</a> ·
    <a href="#try-a-real-operation">Try it</a> ·
    <a href="docs/modules.md">Build a module</a> ·
    <a href="docs/architecture.md">Architecture</a>
  </p>
</div>

Company OS is a starting point for software that fits how your team works. Fork the repository,
change its business model, and build the operations you need: customer relationships, engineering
delivery, or a domain of your own. You own the source and database.

A module defines its objects and operations in TypeScript. That contract supplies PostgreSQL storage,
validated APIs, a typed client, MCP tools, and default tables, forms, and record pages. Add business
rules with Effect functions and customize the interface with ordinary React components. The same
server-side permissions and transactions apply whether a person clicks a button or an agent calls a tool.

The repository runs locally without a Continual account. [Continual](https://continual.ai) maintains
the project and provides an optional hosting integration. Company OS is **source-available under
[Elastic License 2.0](LICENSE.md)**. Its APIs are still evolving; expect changes before a stable release.

## Quick start

Install Node.js 24+, pnpm 11, and PostgreSQL 18+. PostgreSQL must be running and your local role must
be able to create a database.

```sh
git clone https://github.com/continual-ai/company-os.git
cd company-os
pnpm install --frozen-lockfile
pnpm dev
```

Open **[localhost:3002](http://localhost:3002)**. Development signs you in as a local administrator;
no OAuth setup, API key, bucket, or hosted service is needed.

`pnpm dev` creates the local database when needed, applies committed migrations, and starts the app.
The default connection is `postgresql://localhost:5432/company_os`. For another PostgreSQL role or
endpoint, put `DATABASE_URL` in an ignored `.env.local` at the repository root. See the
[database guide](docs/runbooks/database.md) for connection details, migrations, and test setup.
The development server is trusted local tooling; its automatic identity is disabled in production.

## Try a real operation

1. Open **Sales → Leads** and create a lead with a company name and contact details.
2. Open the lead and choose **Convert**. One authorized transaction creates a company and contact,
   connects them, and records the conversion. Repeating conversion returns the existing result.
3. Open the **Conversion** tab to continue in the new company or contact record.
4. Open **Engineering → Issues**. Create an issue, assign an owner, and attach a file. The default
   field handles upload, validation, and protected file delivery.
5. Open **Developer Center** to inspect the model, generated HTTP API, client examples, and MCP tools.
6. Try **Pipeline** on Deals, **Board** on Issues, and **Calendar** or **Timeline** on Campaigns.
   Layout settings select model fields; temporary changes stay in the URL. [Define collection views](docs/collections.md).
7. Press **Command/Ctrl-K** to search records across modules, jump to a collection, or create a record.
   [Search fields are declared on each object](docs/search.md).

The OpenAPI document is at [`/api/openapi`](http://localhost:3002/api/openapi).

Sales, Marketing, Support, and Engineering are editable starting models. Connect campaigns to
contacts, support tickets to engineering issues, and issues to pull requests. These records hold
shared operational state; sending, publishing, merging, and agent execution require explicit
integrations. No business data is fabricated during setup.

## One module, three entrypoints

```text
apps/company-os/src/modules/sales/
  model.ts                       Objects, interfaces, and links
  server.ts                      Custom operation bindings
  ui.ts                          Object UI composition
  lead/model.ts                  Lead definition and operation contracts
  lead/server/convert.ts         Transactional lead conversion
  lead/ui/config.ts              Lead UI registration
  lead/ui/conversion-tab.tsx      Ordinary React component
  deal/server/pipeline-summary.ts Authorized aggregate SQL
  links/contact-companies.ts     One bidirectional relationship
```

Only the model entrypoint is required. A standard object gets persistence, governed CRUD, APIs, and
usable screens without its own service or route files. The application's model, server, and UI
composition roots each register a module once; further changes stay inside the module.

The included Marketing module follows this same pattern (simplified here):

```ts
import { defineObject, schema } from "@company/runtime"
import { User } from "#modules/access/user/model"
import { Root } from "#root"

export const Campaign = defineObject({
  id: "campaign",
  collection: "campaigns",
  name: "Campaign",
  pluralName: "Campaigns",
  parent: Root,
  properties: {
    name: schema.string({ minLength: 1, maxLength: 200 }),
    owner: schema.reference(User, { nullable: true }),
    attachments: schema.array(schema.file(), { default: [] }),
  },
  display: { title: "name" },
})
```

Put the object in `modules/marketing/campaign/model.ts`, include it in the Marketing module’s
`model.ts`, and install that module in `src/model.ts`. Regenerate `schema.sql`, write and review the corresponding SQL migration, then assign
the intended permissions.
Its default page is `/objects/campaign`. See [Building a module](docs/modules.md) for the complete
path, custom actions, React extensions, and client data access.

Modules are source you copy, compose, and edit. They are not dynamically loaded plugins. A custom
page can replace a default screen, and custom operations can enforce rules that a schema cannot express.

## How the pieces fit

```text
React UI       Typed client       HTTP / OpenAPI       MCP tools
    \               |                   |                /
     +--------------+-------------------+---------------+
                            |
                   Queries and Actions
                            |
             Identity → authorization → operations
                            |
                 PostgreSQL transactions
```

- **Model:** portable, browser-safe TypeScript. Objects have durable identity; references, Links,
  and association Objects describe different kinds of relationships.
- **Server:** Effect v4 operations enforce permissions and business rules. PostgreSQL is authoritative;
  Effect SQL implements persistence and explicit migrations over model-derived PostgreSQL tables.
- **UI:** TanStack Start, Router, and Form with editable shadcn primitives and Tailwind CSS v4.
  Standard collection pages share filters, views, forms, relationships, and file fields.
- **Data access:** a generated semantic client over HTTP. One TanStack Query cache serves
  SSR, preloading, and React reads; successful transactions invalidate the object types actually changed.
  `list` supports filtering and pagination; relationship pages return complete target records.
  `batchGet` hydrates independently known references; custom Queries share the same cache.

A [durable event journal](docs/events.md) records committed changes and typed business facts.
Open browsers apply authorized record snapshots and refresh affected queries, including after reconnect.
Use `useQuery(data.contact.list(...))` and `useMutation(data.contact.update())`; [one data path](docs/data.md) handles caching and changes.
This is cached server state with resumable SSE and pull recovery; offline writes, durable agent scheduling, and
automation controllers are not included. [Architecture](docs/architecture.md) explains the current guarantees and boundaries.

## Read the code

| Start here                                       | What it owns                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| [Company OS app](apps/company-os/README.md)      | The central UI, API, business policy, and server assembly        |
| [Modules](apps/company-os/src/modules/README.md) | Editable Sales, Marketing, Support, and Engineering domains      |
| [Runtime](packages/runtime/README.md)            | Portable model definitions and reusable execution/API machinery  |
| [Postgres](packages/postgres/README.md)          | Model-to-storage projection and repository implementations       |
| [UI](packages/ui/README.md)                      | Shared presentation primitives and design tokens                 |
| [Documentation](docs/README.md)                  | Module authoring, modeling, architecture, and operational guides |

Start with the app and a concrete module; read the reusable packages when you need to change a
shared mechanism. Business code stays in the app. Optional interfaces consume its public
`company-os/model` contract and governed API.

## Make it yours

Change product identity and the entry experience in
[`src/customization`](apps/company-os/src/customization), then build your operation in
[`src/modules`](apps/company-os/src/modules). The included agent skills help with company onboarding,
customization, and upstream upgrades. A useful first prompt is:

> Use $company-onboard to build our customer onboarding process. Track customers, milestones,
> owners, blockers, and launch dates. Let an agent prepare follow-ups, with a person approving
> anything sent to a customer. Build one working operation through the UI and API.

Need a separate portal or public website? Copy an optional app starter:

```sh
pnpm app:create                         # List templates
pnpm app:create base vendor-portal
pnpm turbo run dev --filter=vendor-portal
```

The [base](templates/base/README.md), [client portal](templates/client-portal/README.md), and
[marketing site](templates/marketing-site/README.md) are editable starters. The central app remains
the authority for business records and policy. See [deployment](docs/runbooks/deployment.md) for the
current production build and identity integration, including the optional Continual publisher.

## Development

Run commands from the repository root:

| Command                                | Purpose                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                             | Migrate and run the apps in `apps/*`                                    |
| `pnpm check`                           | Verify formatting, lint, package/model boundaries, dead code, and types |
| `pnpm test`                            | Run unit and isolated PostgreSQL integration tests                      |
| `pnpm build`                           | Build the application and maintained app starters                       |
| `pnpm format`                          | Format source and documentation                                         |
| `pnpm --filter company-os db:generate` | Regenerate the current model-derived `schema.sql`                       |

Tests need a PostgreSQL role with `CREATEDB`; they create and remove isolated databases rather than
changing your app's records. [Database workflow](docs/runbooks/database.md) covers this lifecycle.
[AGENTS.md](AGENTS.md) defines repository-wide contributor constraints; package exports and automated
checks enforce the code boundaries.

## License

[Elastic License 2.0](LICENSE.md). Read the license before redistributing Company OS or offering it
as a hosted service.
