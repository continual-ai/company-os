# Company OS app

Acme's backend and company management application in one TanStack Start deployment.

This app is the repository's private composition root. It currently projects the semantic contract
from `@acme/api` into Drizzle storage, API descriptions, OpenAPI, and assembled Effect repository
and service layers. The executable external routes are the health and contract/documentation
endpoints listed below; object CRUD and custom-action handlers have not yet been bound. As those
transports are added, the operating application, agents, and external interfaces should call the
same governed company capabilities.

## Owns

- Private business implementations and orchestration
- Authentication and authorization enforcement
- Persistence, migrations, and transactions
- Provider adapters and runtime configuration
- Internal operating, development, and learning routes
- Server functions and external API routes

It does not define reusable framework primitives or a second copy of the company contract. Keep
server-only code under `src/server` or in clearly named `.server.ts` modules.

## Server organization

The server mirrors the ontology without creating aggregate runtime services for navigation areas.
Each implemented object has one replaceable repository capability and one governed service
capability. The intended request path is:

```text
HTTP / MCP / agents
        |
        v
object services / actions
        |
        v
object repositories
        |
        v
Drizzle schema and queries
        |
        v
Effect PostgreSQL client
```

- A custom action belongs in the public model only when a corresponding service implementation and
  transport binding exist.
- Handlers call the governed service method corresponding to the declared object operation.
- Cross-object service methods coordinate governed object services and own their transaction.
- Object services are the authoritative boundary for authorization, portable schema validation,
  metadata, and object-level behavior, regardless of whether the caller is HTTP, MCP, an agent, a
  job, or another service.
- Repositories atomically maintain the shared object row, same-ID object-specific row, and declared
  interface membership rows, implement all-or-nothing batch writes, and own custom persistence
  queries; only repository implementations access the database, and they do not duplicate portable
  property validation as SQL checks.

The portable repository contract and standard service behavior come from `@continual/runtime`;
`@continual/postgres` supplies the reusable Drizzle schema compiler and repository implementation.
Acme owns the concrete storage projection, physical overrides, migrations, and typed `Database`
service in this app. Interface membership uses internal tables named from immutable interface IDs
rather than display metadata. Every object-specific table mirrors the standard `parentId` under
its semantic name—such as `rootId`, `workspaceId`, or `dealId`—while a composite foreign key
ensures it remains identical to the generic parent on the shared object row. The shared row also
stores complete ancestry.
Globally unique opaque aliases live in normalized `object_aliases` rows and are hydrated as the
standard `aliases` set on every public object record. Repository transactions claim and release
those rows with the corresponding object write; the model-storage resolver can therefore locate an
object by alias without first knowing its object type. Authorization still happens in the governed
service or handler after resolution.
Files under `src/server/objects` keep each object's service beside its repository. Add an
object-specific repository query only when the standard object query language cannot express the
required persistence operation. The composition root wires Layers to infrastructure; it does not
become another business service.

## Database workflow

The app uses `@continual/postgres` with the Effect PostgreSQL driver. The portable `AcmeModel` is
the source of truth for objects, properties, interfaces, ownership, and links.
`src/server/database/schema.server.ts` instantiates the reusable compiler and contains only
deliberate Acme-specific physical overrides such as generated columns and indexes. There is no
generated TypeScript schema and no handwritten second copy of the model. Drizzle Kit reads the
projection and generates an explicit, immutable SQL history under
`src/server/database/migrations`. Deployments run migrations separately before serving the
corresponding application revision.

### Local setup

Create a dedicated local PostgreSQL database, then copy the example environment and adjust its
credentials if necessary:

```sh
cp apps/company-os/.env.example apps/company-os/.env.local
pnpm --filter company-os db:migrate
```

`db:migrate` loads `apps/company-os/.env.local` when present and otherwise uses `DATABASE_URL` from
the process environment. It applies only migrations not already recorded by Drizzle and is safe to
run repeatedly.

### Change the schema

1. Edit the source contract in `packages/acme/api`. Change
   `src/server/database/schema.server.ts` only when the physical projection needs a deliberate
   database-specific override.
2. Generate a named migration from the repository root:

   ```sh
   pnpm --filter company-os db:generate --name add_company_owner
   ```

3. Review both the generated `migration.sql` and `snapshot.json`. Check renames, destructive DDL,
   defaults, indexes, foreign keys, locks, and data backfills explicitly.
4. Validate the migration history and rebuild a fresh database through the integration tests:

   ```sh
   pnpm --filter company-os db:check
   pnpm --filter company-os test
   ```

5. Apply the migration to the local database and exercise the affected repository behavior:

   ```sh
   pnpm --filter company-os db:migrate
   ```

For SQL that Drizzle cannot derive, generate an empty, tracked migration instead of creating an
untracked script:

```sh
pnpm --filter company-os db:generate:custom --name backfill_company_owner
```

Keep the TypeScript schema, generated SQL, snapshot, and application change in the same commit. Do
not use `drizzle-kit push`; every environment, including local development, should exercise the
same committed history.

### Reset local development

Reset deletes every object in the `public` and Drizzle migration schemas, recreates `public`, and
then applies the full committed migration history. It accepts only loopback PostgreSQL hosts and
requires the exact database name as confirmation:

```sh
CONFIRM_DATABASE_RESET=company_os pnpm --filter company-os db:reset
```

Use a dedicated local database. The reset is destructive and unrecoverable; it deliberately
refuses remote database URLs. Tests do not require this command because they rebuild an isolated
PGlite database from the same migration history.

### Production deployment

Run migrations as one explicit release job from the same immutable revision that will be deployed:

```sh
DATABASE_URL="$PRODUCTION_DATABASE_URL" pnpm --filter company-os db:migrate
```

The deployment sequence is:

1. Back up the database or verify the provider's restore point and test the migration on a
   production-like copy when risk warrants it.
2. Run one migration job. Do not run migrations concurrently from every application instance.
3. Deploy or promote the compatible application revision only after migration succeeds.
4. Verify the health endpoint and the affected read/write path.

Production migrations are forward-only. Rolling back application code does not roll back the
database: use backward-compatible expand/contract changes, then append a corrective migration when
needed. Never run `db:reset`, `drizzle-kit push`, or an automatic production-schema diff in a shared
or production environment.

- Never edit a migration after it has reached a shared environment; append another migration.
- Keep migrations forward-moving and use expand/contract changes when old and new application
  revisions may overlap.
- Review generated SQL before deployment. Never derive and automatically apply a migration by
  diffing directly against production.
- Run non-transactional PostgreSQL operations, including concurrent index creation, through a
  deliberately separate migration path when the first concrete need arises.
- Rebuild an empty database from the full history in CI. Repository integration tests run the same
  history against PGlite before exercising object behavior.

## Develop

```sh
pnpm --filter company-os dev
```

Open <http://localhost:3002>. Useful endpoints:

- `/` — operating overview
- `/develop` — model, API, data, and design-system surfaces
- `/learn` — company knowledge and guidance

- `GET /health` — process health
- `GET /api/description` — serializable API projection of `AcmeModel`
- `GET /api/openapi` — runtime-derived OpenAPI 3.1 contract
- `GET /api/docs` — generated Scalar API reference

Set the public deployment origin when generating canonical URLs and social-card metadata:

```sh
VITE_COMPANY_OS_URL=https://os.example.com
```

The app omits canonical URLs and absolute share-image metadata when this value is unset, preventing
local development URLs from leaking into production metadata.

## Page metadata

Keep page meaning beside the route that owns it. Static routes pass one local object to
`pageOptions`; the root document derives the title, description, social tags, and canonical URL from
the active TanStack matches:

```tsx
const page = {
  breadcrumb: "Companies",
  description: "Browse Acme company records.",
  title: "Companies",
}

export const Route = createFileRoute("/_app/companies")({
  ...pageOptions(page),
  component: CompaniesPage,
})
```

Do not repeat the route path in page metadata. Breadcrumb links and canonical URLs come from the
matched pathname. When metadata depends on params or loaded content, return the same `page` shape
from the route loader beside the data used by the component:

```tsx
export const Route = createFileRoute("/_app/companies/$companyId")({
  loader: async ({ params }) => {
    const company = await loadCompany(params.companyId)

    return {
      company,
      page: {
        breadcrumb: company.name,
        description: `Review ${company.name} in Company OS.`,
        title: company.name,
      },
    }
  },
  head: ({ loaderData }) => documentHead(loaderData.page),
  component: CompanyPage,
})
```

Use `staticData` only for synchronously available route data. Use loaders for metadata that varies by
params, search, permissions, or fetched records.
