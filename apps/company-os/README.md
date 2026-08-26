# Company OS app

The repository's central backend and operating application in one TanStack Start deployment.

This app is the repository's private composition root. It projects the semantic contract from
`@company/model` into Drizzle storage, model metadata, OpenAPI, HTTP, and MCP over the assembled
Effect repository and service layers. OIDC browser sessions and service-account API
credentials remain outside this app; verified deployment assertions resolve to the same governed
invocation context. The operating application, agents, and external interfaces call the same
company capabilities rather than owning separate business logic.

## Owns

- Private business implementations and orchestration
- Identity assertion verification and business authorization enforcement
- Persistence, migrations, and transactions
- Provider adapters and runtime configuration
- Internal operating, development, and learning routes
- Server functions and external API routes

It does not define reusable framework primitives or a second copy of the company contract. TanStack
import protection treats `src/server` as a hard server-only boundary. Reserve `.server.ts` for
exceptional server-only modules that must remain colocated elsewhere, and use `.functions.ts` for
client-callable `createServerFn` wrappers.

## Customization

`src/customization` is the application-owned customization overlay. Its config covers shallow product
identity, assets, and first-launch copy; its navigation and home modules own the initial operating
experience. Core shell, identity-boundary, design-system, table, form, and accessibility behavior
stay shared. When a use case requires new business behavior, extend the model and governed server
path rather than encoding policy in the overlay or turning the config into a page schema.

## Application organization

The application groups code by responsibility without duplicating the model registry:

- `src/routes` owns TanStack URL entry points. Parenthesized directories such as `(sales)` and
  `(access)` group source by module without adding URL segments.
- `src/ui/application`, `src/ui/model`, `src/ui/settings`, and `src/ui/<module>` separate shell,
  generic model UI, application settings, and module-specific workflows.
- `src/server/model` owns generic model persistence and execution bindings.
- `src/server/modules/<module>` owns behavior and seeds specific to a declared model module.
- `src/server/transport` adapts the one governed model implementation to HTTP and MCP.

`ObjectRepositories` derives the ordinary persistence registry from the closed model. Governed
services reuse that registry; only objects with additional behavior receive a named service. The
intended request path is:

```text
HTTP / MCP / agents
        |
        v
verify identity assertion and provide CurrentInvocation
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
- `ModelImplementation` exhaustively binds the closed model to those services; it validates the
  projection boundary but does not add another execution layer.
- HTTP groups, OpenAPI operations, clients, and MCP tools derive from that binding rather than
  maintaining protocol-specific operation registries.
- Cross-object service methods coordinate governed object services and own their transaction.
- Object services are the authoritative boundary for authorization, portable schema validation,
  caller-owned metadata, audit actors, write preconditions, and object-level behavior, regardless
  of whether the caller is HTTP, MCP, an agent, a job, or another service.
- Repositories atomically maintain the shared object row, same-ID object-specific row, and declared
  interface membership rows, assign entity tags and storage timestamps, implement all-or-nothing
  batch writes, and own custom persistence queries; only repository implementations access the
  database, and they do not duplicate portable property validation as SQL checks.

Authorization uses the same ontology and storage path as business data. An identity acts as itself,
as every group it belongs to, and as the system-defined principal sets implied by its authentication
state. `allCallers` also applies without credentials; `allAuthenticatedCallers` applies whenever the
configured authentication boundary accepts a verified assertion.
Role assignments grant exact model-derived capabilities to a principal at an authorization scope;
the grant applies to that scope and its ownership descendants. Object services deny by default,
authorize batches atomically, conceal unreadable records as missing, and constrain lists in SQL
before filtering or pagination. The authorization repository is a read-optimized projection over
those ordinary objects and links, not a second policy database. Decisions read current group
membership and role assignments with set-based SQL rather than caching policy state or issuing
queries per target.

Clients may batch advisory UI checks through `POST /api/v1/capabilities:check`. Each check names
one model-derived permission and may name a canonical target; omitting the target asks whether the
caller has that permission at any scope. The endpoint accepts anonymous requests, validates any
credentials that are supplied, preserves request order, and returns only `allowed` booleans so
concealed resources and denied resources remain indistinguishable. It never replaces enforcement:
CRUD and custom action services evaluate the same policy again inside their transaction.

Interactive surfaces fail closed: mutation controls appear only after an affirmative capability
result. Generic object collections derive checks from model actions and pass a `can` predicate to
custom collection and record actions. New custom UI should follow that same pattern, while server
services remain the authority even when a client has just received an allowed result.

The standard Streamable HTTP MCP endpoint is `/api/mcp`. It authenticates through the same
application boundary as `/api/v1`, establishes the same `CurrentInvocation`, and exposes every
model query and action as a tool named `<object>.<operation>`. Tool schemas and read-only,
destructive, and idempotent hints derive from the model. Deployment-specific MCP authorization
discovery can be added at the identity edge without changing model services or tool definitions.

`systemManaged` is immutable ownership provenance on the shared object row. It does not grant read
access or replace hierarchy: ordinary actors follow normal role inheritance but cannot update or
delete a system-managed record. The well-known system service account is reserved for internal
seeds, jobs, and named workflows. It receives permissions through the same role assignments as
other identities; its only special authority is managing system-owned records, and it still passes
through validation, transactions, and domain invariants.

The request boundary distinguishes callers without credentials, verified external subjects, and
canonical local identities. The deployment gateway owns login, sessions, invitations, credentials,
API keys, provider-specific directory administration, and any delegation it asserts. Company OS
verifies its signed identity assertion, maps stable `(issuer, subject)` values through
`identity_bindings`, and JIT-provisions a minimal local `User` or `ServiceAccount` projection when
configured to do so. Email is mutable profile data, never an account-linking key or local uniqueness
constraint; issuer changes require explicit reconciliation. Trusted asserted names and email
addresses refresh the projection after a stable binding resolves.

`User` and `ServiceAccount` implement `Identity`, while the audit-only `AnonymousActor` represents
operations deliberately allowed without an authenticated identity. It is displayed as “Anonymous,”
is not a User, Identity, or Principal, and cannot receive roles. Public permissions belong to an
`allCallers` PrincipalSet rather than to the anonymous actor. The well-known System identity is a
system-managed ServiceAccount because it performs authorized non-human work. Groups and principal
sets do not authenticate; authorization expands caller state into the applicable Principals.

The standalone deployment reads the identity contract through Effect `Config`:

- `AUTH_MODE=local` presents a development-only sign-in page with administrator, operator, and
  restricted Users. A session cookie selects an opaque profile ID; it contains no credentials and
  this mode is rejected in production. `AUTH_LOCAL_SUBJECT`, `AUTH_LOCAL_NAME`,
  `AUTH_LOCAL_EMAIL`, and `AUTH_JIT_ROLE` customize the administrator profile.
- `AUTH_MODE=jwt` verifies the assertion in `AUTH_JWT_HEADER` against `AUTH_JWT_ISSUER`,
  `AUTH_JWT_AUDIENCE`, and `AUTH_JWT_JWKS_URL`. Continual or another trusted gateway may supply it.
  Assertions must contain non-empty `iss`, `sub`, `aud`, `iat`, and `exp` claims, use an explicitly
  allowed asymmetric algorithm, and remain within `AUTH_JWT_MAX_AGE`. The configured
  `identity_type` claim must resolve to `user` or `serviceAccount`; a deployment that only admits one
  type may set `AUTH_JWT_DEFAULT_IDENTITY_KIND`. `AUTH_SIGN_OUT_PATH` names the gateway-owned,
  same-origin logout route used by the application account menu.
- `AUTH_MODE=google-iap` fixes the header, issuer, ES256 algorithm, IAP JWK set, clock tolerance, and
  User identity type to Google's signed-header contract. The deployment supplies only the exact
  `AUTH_IAP_AUDIENCE` shown by IAP and its initial role policy. Sign-out uses Google's documented
  external-identity `?gcp-iap-mode=GCIP_SIGNOUT` handoff by default; `AUTH_SIGN_OUT_PATH` can select
  another same-origin IAP or proxy session contract.
- `AUTH_JIT_ROLE` controls the initial role for the customizable local profile and for newly
  projected authorization subjects in deployed modes. Local development defaults that profile to
  `administrator`; the built-in operator and restricted profiles remain fixed. Every deployed mode
  must choose `administrator`, `operator`, or `none` explicitly. In a delegated invocation, the
  current actor is projected without inheriting that role merely because it acted for an authorized
  subject.

The generic JWT adapter understands the RFC 8693 `act` claim. Without it, the assertion `sub` is both
the current actor and authorization subject. With it, `sub` is the identity whose business authority
is evaluated and the outermost `act` identity is the actor durably written to `createdBy` and
`updatedBy`. The trusted gateway must authorize the delegation before issuing the assertion; Company
OS still requires both local identities to be active and applies its business authorization to the
subject. Nested prior actors are ignored by access control. Identity type is only a transient
assertion-edge discriminator used to instantiate the closed `User | ServiceAccount` model; it is not
a durable `kind` property on either object.

Do not expose the application directly while relying on a gateway assertion header. The JWT is
still verified by this app, and the gateway or ingress must prevent clients from bypassing its own
authentication and membership checks. Unsigned convenience headers are never trusted. Replacing
providers changes the assertion adapter and bindings, not Company OS business services or
authorization policy. A provider that does not emit a verifiable JWT should supply its own
`IdentityProvider` adapter rather than weakening this boundary.

`ActorId`, `IdentityId`, and `PrincipalId` are derived from the closed `Model`, so each is the
branded union of its interface's concrete implementers. `Actor` is `User | ServiceAccount |
AnonymousActor`; `Identity` is `User | ServiceAccount`; and `Principal` is `User | ServiceAccount |
Group | PrincipalSet`. Invocation and audit fields use `actorId`; authenticated caller state uses
`identityId`; role assignments use `principal`.

The portable repository contract and standard service behavior come from `@company/runtime`;
`@company/postgres` supplies the reusable Drizzle schema compiler and repository implementation.
The repository owns the concrete storage projection, migrations, and typed `Database` service in
this app.
Interface membership uses internal tables named from immutable interface IDs rather than display
metadata. Portable records expose `parent`; generated Drizzle rows use
`parentId`; and every object-specific table stores `parent_id`. A composite foreign key ensures it
remains identical to the generic parent on the shared object row. Ordinary record-reference
properties use their semantic relationship name plus `Id`, such as `companyId`; ownership always
uses `parentId` regardless of the parent's concrete type. The shared row also stores complete
ancestry and references the model-declared Actor interface from its audit actor columns.
Globally unique opaque aliases live in normalized `record_aliases` rows and are hydrated
as the standard `aliases` set on every public object record. Repository transactions claim and
release those rows with the corresponding object write; the PostgreSQL adapter can therefore
locate an object by alias without first knowing its object type. The application-owned record
identifier resolver validates the expected object or interface before returning a canonical ID.
Well-known application-managed records instead use stable, readable canonical IDs such as
`service_account_system`; prefixes are
diagnostic only and code never infers behavior from them. The shared object-service factory uses
that resolver to canonicalize every reference and then authorizes the request. Repositories and
stored foreign keys receive canonical IDs only. Generic repositories and services live under
`src/server/model`; behavior specific to Access or Sales lives under the corresponding
`src/server/modules` directory. Add an object-specific repository query only when the standard
object query language cannot express the required persistence operation. The composition root
wires Layers to infrastructure; it does not become another business service.

## Database workflow

The app uses `@company/postgres` with the Effect PostgreSQL driver. The portable `Model` is
the source of truth for objects, properties, interfaces, ownership, links, and uniqueness.
`src/server/database/schema.ts` only instantiates the reusable compiler and exposes its
tables as direct ESM exports because Drizzle Kit does not inspect nested schema objects. The app
adds only the provider-neutral `identity_bindings` table beside that generated projection;
it stores no credentials or sessions. A schema test ensures the static tooling exports cover the
complete projection. There is no
handwritten second copy of the company model. Drizzle Kit reads the
projection and generates explicit SQL under `src/server/database/migrations`. Each migration also
contains Drizzle's machine-generated schema snapshot: the SQL is the reviewed executable history,
while the snapshot is committed compiler state used to generate and check later migrations. Never
edit a snapshot by hand. Before the baseline is pushed or applied anywhere, keep one reviewed
`initial` migration and replace it whenever the model changes. Once a migration may have reached
another developer, shared environment, or production database, freeze it and append forward-only
migrations. Deployments apply the committed history and converge required records before
serving the corresponding application revision.

### Local setup

Start the repository-owned local PostgreSQL service and converge the committed schema:

```sh
pnpm setup
```

The setup command creates `apps/company-os/.env.local` from the example when it is absent. Local
identity mode works without an external provider. Start with `pnpm dev`, then choose an
administrator, operator, or restricted identity on `/sign-in`. Use the account menu to sign out and
switch identities without restarting the server. Development reapplies pending migrations and
converges required records before starting Company OS. Use `pnpm dev:all` when the demonstration
marketing site and client portal are also needed.

Each local profile has a stable subject and receives its initial role only when it is first
provisioned. The administrator exercises the full surface, the operator exercises the built-in
business-data boundary, and the restricted User verifies default-deny and fail-closed UI behavior.
Changing a profile's configured initial role does not reconcile existing assignments; change its
role assignments through the governed application surface or reset the local database.

Database commands load `apps/company-os/.env.local` when present and otherwise use `DATABASE_URL`
from the process environment. TanStack Start also loads that app-local file for development while
production supplies the same contract through deployment environment injection. Only `VITE_`
variables may enter browser code; database and identity assertion configuration remain server-only.
The `.env.local` file is ignored and `.env.example` contains no usable credentials.

`db:migrate` applies only migrations not already recorded by
Drizzle. `db:seed` idempotently converges the built-in Root, system identity, principal sets,
roles, and initial role assignments through stable canonical IDs. `db:deploy` performs both in that
order and is the normal setup and release command. Raw persistence establishes only the cyclic
Root and system Actor needed to begin; repositories converge the concrete system account and
all remaining records. All three commands are safe to run repeatedly.

### Change an unshared baseline

1. Edit the source contract in `packages/company/model`. When registering a new object or interface,
   expose its generated table from `src/server/database/schema.ts` for Drizzle Kit; the
   schema coverage test fails if that tooling export is missing.
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

This replacement workflow is limited to a baseline that has never been pushed or applied outside
your disposable local database. After that point, preserve it and generate a descriptive migration
such as `pnpm --filter company-os db:generate --name add_company_owner` for every subsequent schema
change.

Drizzle does not currently represent PostgreSQL constraint deferrability in its schema definition.
Any migration that creates or replaces the `objects.created_by_id` or `objects.updated_by_id`
foreign key must retain `DEFERRABLE INITIALLY DEFERRED`; bootstrapping the mutually dependent
Root and system Actor requires those checks to run at transaction commit. The migration
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

Reset deletes every object in the `public` and Drizzle migration schemas, cleans up the historical
`auth` schema when present, recreates
`public`, and then applies the full committed migration history and all required seeds. It
accepts only loopback PostgreSQL hosts and requires the exact database name as confirmation:

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
   required seeds. Do not run it concurrently from every application instance.
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
- `/develop` — model, API, SDK, MCP, and design-system surfaces

- `GET /health` — process health
- `/api/v1/*` — governed object reads, mutations, declared actions, and capability checks
- `POST /api/mcp` — Streamable HTTP MCP projection of the same governed operations
- `GET /api/description` — serializable API projection of `Model`
- `GET /api/openapi` — runtime-derived OpenAPI 3.1 contract
- `/develop/api` — integrated reference over the generated OpenAPI contract

Set the public deployment origin for canonical URLs and the MCP Host/Origin allowlist:

```sh
VITE_COMPANY_OS_URL=https://os.example.com
```

The app omits canonical URLs when this value is unset, preventing local development URLs from
leaking into production metadata.

## Page metadata

Keep page meaning beside the route that owns it. Static routes pass one local object to
`pageOptions`; the root document derives the title, description, social tags, and canonical URL from
the active TanStack matches:

```tsx
const page = {
  breadcrumb: "Companies",
  description: "Browse company records.",
  title: "Companies",
}

export const Route = createFileRoute("/_app/(sales)/companies")({
  ...pageOptions(page),
  component: CompaniesPage,
})
```

Do not repeat the route path in page metadata. Breadcrumb links and canonical URLs come from the
matched pathname. When metadata depends on params or loaded content, return the same `page` shape
from the route loader beside the data used by the component:

```tsx
export const Route = createFileRoute("/_app/(sales)/companies/$companyId")({
  loader: async ({ params }) => {
    const company = await loadCompany(params.companyId)

    return {
      company,
      page: {
        breadcrumb: company.name,
        description: `Review ${company.name} in the operating app.`,
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
