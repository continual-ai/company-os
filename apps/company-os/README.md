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
authenticate and provide CurrentInvocation
        |
        v
thin protocol handlers
        |
        v
governed object services / actions <--> Authorization
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
- Handlers call the governed service method corresponding to the declared object query or action.
- Cross-object service methods coordinate governed object services and own their transaction.
- Object services are the authoritative boundary for authorization, portable schema validation,
  caller-owned metadata, audit identity, write preconditions, and object-level behavior, regardless
  of whether the caller is HTTP, MCP, an agent, a job, or another service.
- Repositories atomically maintain the shared object row, same-ID object-specific row, and declared
  interface membership rows, assign entity tags and storage timestamps, implement all-or-nothing
  batch writes, and own custom persistence queries; only repository implementations access the
  database, and they do not duplicate portable property validation as SQL checks.

Authorization uses the same ontology and storage path as business data. An authenticated identity
acts as itself and as every group it belongs to. Role assignments grant exact model-derived
capabilities to a principal at an authorization scope; the grant applies to that scope and its
ownership descendants. Object services deny by default, authorize batches atomically, conceal
unreadable records as missing, and constrain lists in SQL before filtering or pagination. The
authorization repository is a read-optimized projection over those ordinary objects and links,
not a second policy database. Decisions read current group membership and role assignments with
set-based SQL rather than caching policy state or issuing queries per target.

`systemManaged` is immutable ownership provenance on the shared object row. It does not grant read
access or replace hierarchy: ordinary actors follow normal role inheritance but cannot update or
delete a system-managed record. The well-known system service account is reserved for internal
seeds, jobs, and named workflows. It receives permissions through the same role assignments as
other identities; its only special authority is managing system-owned records, and it still passes
through validation, transactions, and domain invariants.

An invocation boundary authenticates external credentials, resolves them to a canonical Identity
record ID, rejects the reserved system actor, and provides `CurrentInvocation` through
`authenticatedInvocation`. Acme pins the server-owned Platform root; callers never choose it from
request data. Internal entrypoints explicitly use `systemInvocation`. HTTP, MCP, jobs, and agents
should otherwise differ only in how they establish that trusted context before calling the same
governed services. Executable object handlers are not bound yet.

`IdentityId` and `PrincipalId` are derived from the closed `AcmeModel`, so each is the branded union
of its interface's concrete implementers. `actorId` names an identity in invocation and
authorization internals; `principal` names the identity-or-group relationship on role assignments.
There is no separate `ActorId` brand or Actor object.

The portable repository contract and standard service behavior come from `@continual/runtime`;
`@continual/postgres` supplies the reusable Drizzle schema compiler and repository implementation.
Acme owns the concrete storage projection, physical overrides, migrations, and typed `Database`
service in this app. Interface membership uses internal tables named from immutable interface IDs
rather than display metadata. Portable records expose `parent`; generated Drizzle rows use
`parentId`; and every object-specific table stores `parent_id`. A composite foreign key ensures it
remains identical to the generic parent on the shared object row. Ordinary record-reference
properties use their semantic relationship name plus `Id`, such as `companyId`; ownership always
uses `parentId` regardless of the parent's concrete type. The shared row also stores complete
ancestry and references the model-declared Identity interface from its audit actor columns.
Globally unique opaque aliases live in normalized `record_aliases` rows and are hydrated
as the standard `aliases` set on every public object record. Repository transactions claim and
release those rows with the corresponding object write; the model-storage resolver can therefore
locate an object by alias without first knowing its object type. Well-known source-owned records
instead use stable, readable canonical IDs such as `service_account_system`; prefixes are
diagnostic only and code never infers behavior from them. The shared object-service factory
validates the expected object or interface type, canonicalizes every reference, and then authorizes
the request. Repositories and stored foreign keys receive canonical IDs only. Files under
`src/server/objects` keep each object's service beside its repository. Add an object-specific
repository query only when the standard object query language cannot express the required
persistence operation. The composition root wires Layers to infrastructure; it does not become
another business service.

## Database workflow

The app uses `@continual/postgres` with the Effect PostgreSQL driver. The portable `AcmeModel` is
the source of truth for objects, properties, interfaces, ownership, and links.
`src/server/database/schema.server.ts` instantiates the reusable compiler and contains only
deliberate Acme-specific physical overrides such as generated columns and indexes. There is no
generated TypeScript schema and no handwritten second copy of the model. Drizzle Kit reads the
projection and generates explicit SQL under `src/server/database/migrations`. Each migration also
contains Drizzle's machine-generated schema snapshot: the SQL is the reviewed executable history,
while the snapshot is committed compiler state used to generate and check later migrations. Never
edit a snapshot by hand. While the baseline is still pre-deployment, keep one reviewed `initial`
migration and replace it whenever the model changes. Once any shared or production database depends
on that baseline, freeze it and append forward-only migrations. Deployments apply the committed
history and converge source-owned records before serving the corresponding application revision.

### Local setup

Create a dedicated local PostgreSQL database, then copy the example environment and adjust its
credentials if necessary:

```sh
cp apps/company-os/.env.example apps/company-os/.env.local
pnpm --filter company-os db:deploy
```

Database commands load `apps/company-os/.env.local` when present and otherwise use `DATABASE_URL`
from the process environment. `db:migrate` applies only migrations not already recorded by
Drizzle. `db:seed` idempotently converges the built-in Platform, system identity, administrator
role, and initial role assignment through stable canonical IDs. `db:deploy` performs both in that
order and is the normal setup and release command. Raw persistence establishes only the cyclic
Platform and audit Identity needed to begin; repositories converge the concrete system account and
all remaining records. All three commands are safe to run repeatedly.

### Change the pre-deployment baseline

1. Edit the source contract in `packages/acme/api`. Change
   `src/server/database/schema.server.ts` only when the physical projection needs a deliberate
   database-specific override.
2. Remove the existing baseline migration directory and generate a new baseline from the repository
   root:

   ```sh
   pnpm --filter company-os db:generate --name initial
   ```

3. Review the generated `migration.sql`. Check renames, destructive DDL, defaults, indexes, foreign
   keys, locks, and data backfills explicitly. Confirm that Drizzle produced `snapshot.json` and
   commit it unchanged; it is generated diff state rather than a human-authored migration.
4. Validate the migration history and rebuild a fresh database through the integration tests:

   ```sh
   pnpm --filter company-os db:check
   pnpm --filter company-os test
   ```

5. Reset the dedicated local database and exercise the affected repository behavior:

   ```sh
   CONFIRM_DATABASE_RESET=company_os pnpm --filter company-os db:reset
   ```

This replacement workflow is deliberately limited to the current pre-deployment phase. After the
first shared deployment, preserve the baseline and generate a descriptive migration such as
`pnpm --filter company-os db:generate --name add_company_owner` for every subsequent schema change.

Drizzle does not currently represent PostgreSQL constraint deferrability in its schema definition.
Any migration that creates or replaces the `objects.created_by_id` or `objects.updated_by_id`
foreign key must retain `DEFERRABLE INITIALLY DEFERRED`; bootstrapping the mutually dependent
Platform and system Identity requires those checks to run at transaction commit. The migration
integration test verifies the resulting PostgreSQL constraints directly.

For SQL that Drizzle cannot derive, generate an empty, tracked migration instead of creating an
untracked script:

```sh
pnpm --filter company-os db:generate:custom --name backfill_company_owner
```

Keep the TypeScript schema, reviewed SQL, generated snapshot, and application change in the same
commit. Do not use `drizzle-kit push`; every environment, including local development, should
exercise the same committed history.

### Reset local development

Reset deletes every object in the `public` and Drizzle migration schemas, recreates `public`, and
then applies the full committed migration history and all source-owned seeds. It accepts only
loopback PostgreSQL hosts and requires the exact database name as confirmation:

```sh
CONFIRM_DATABASE_RESET=company_os pnpm --filter company-os db:reset
```

Use a dedicated local database. The reset is destructive and unrecoverable; it deliberately
refuses remote database URLs. Tests do not require this command because they rebuild an isolated
PGlite database from the same migration history.

### Production deployment

Run migrations as one explicit release job from the same immutable revision that will be deployed:

```sh
DATABASE_URL="$PRODUCTION_DATABASE_URL" pnpm --filter company-os db:deploy
```

The deployment sequence is:

1. Back up the database or verify the provider's restore point and test the migration on a
   production-like copy when risk warrants it.
2. Run one deployment database job. It applies migrations and then converges the idempotent
   source-owned seeds. Do not run it concurrently from every application instance.
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
