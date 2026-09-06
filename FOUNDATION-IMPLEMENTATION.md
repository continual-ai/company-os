# Foundation checkpoint review

This checkpoint makes source-owned modules the normal authoring path, simplifies server operations,
improves relationship modeling and reads, and adds durable app-owned events. Continual platform contracts remain unchanged.
Changes are uncommitted for review.

## Review path

Start with the [README](README.md), then [Building a module](docs/modules.md). Follow these concrete
files before reading the framework internals:

1. [Engineering Issue](apps/company-os/src/modules/engineering/issue/model.ts): a standard object with an
   owner and attachments, using generated storage, operations, forms, and pages.
2. [Sales bindings](apps/company-os/src/modules/sales/server.ts): named Effect functions bound to
   model-declared operations without a required service/repository pair.
3. [Pipeline summary](apps/company-os/src/modules/sales/deal/server/pipeline-summary.ts): permission to
   invoke a report, row authorization inside SQL, and exact totals grouped by currency.
4. [Lead conversion](apps/company-os/src/modules/sales/lead/server/convert.ts): authorization,
   business invariants, trusted model writers, and one transaction.
5. [Sales UI](apps/company-os/src/modules/sales/ui.ts): shared action placements, record tabs,
   toolbar extensions, and ordinary React components.

The [architecture guide](docs/architecture.md) describes identity, policy, persistence, transport,
and caching. The [modeling guide](docs/modeling.md) explains ownership, references, Links, and
association Objects. Package READMEs describe their boundaries rather than duplicating the app model.

## Durable event checkpoint

Read [Durable events](docs/events.md), then the Lead model's `LeadConverted` definition and its
`EventJournal.append` call in conversion. Standard writers capture Object and Link changes;
custom payload references determine event visibility automatically.

`Database.transaction` stages facts through nested savepoints and writes the journal immediately
before commit. A short counter-row lock establishes replay order. HTTP exposes an authorized,
uncached cursor feed; an authenticated browser consumer resumes after disconnect, refreshes the
existing model cache, and clears it when its readable scopes change. PostgreSQL rejects mutation
of journal history. The event service is part of the app, with no platform publishing dependency.

The additive journal migration is applied to the local development database. Live HTTP checks
created, updated, and removed a temporary company and observed its committed events. Its journal
history remains deliberately append-only. Automated coverage verifies two independent clients:
a disconnected client's observed cache catches up through the HTTP replay feed. Interactive UI
verification remains unavailable while the Mac is locked.

## Simplification review

The journal is now the sole transaction change source. Its successful outer commit supplies HTTP
invalidation; the separate write-set/savepoint tracker and its simulated transaction test are removed.
Real PostgreSQL coverage verifies that savepoint rollback and failed journal persistence publish no
cache changes, and that nested writes publish nothing before the outer commit.

Event facts are validated without fabricated persistence fields. Effect v4 schema composition adds
one shared envelope for replay and OpenAPI, preserving literal event discriminators so TypeScript
narrows payloads by event type. Global alias resolution now has its own PostgreSQL module; it no
longer shares the large per-object CRUD implementation. Public imports remain unchanged.

The explicit model/server/UI composition and ordinary React extension components remain appropriate.
No additional plugin registry, service/repository convention, or client cache was introduced.
Relationship change detection is the remaining notable pressure point: it compares edge sets around
writes to include PostgreSQL cascades. Replacing it with `RETURNING` alone would lose subset removals;
duplicating cascade rules in application code would add another authority. Keep that tradeoff visible
and measure it with a real high-fanout operation before introducing a replacement capture mechanism.

## Object layout and UI cleanup

The latest pass groups each object's definition, server operations, and UI under one directory.
Module entrypoints compose definitions, bindings, and configurations. Links and interfaces have
explicit module-level homes. The model check verifies conventional definition locations, and
browser import protection now explicitly includes module-level `server.ts` entrypoints.

UI configurations use `satisfies ObjectUi<...>` and name additions/replacements explicitly. The
page/form assembly resolves registrations; standard components receive ordinary props. Redundant
render callbacks are removed. Access toolbars now belong to Group and Role instead of routes.
The record Action renderer can run without a registry, and custom page replacements receive route
context without triggering the default page's loading.

The preceding layout/UI cleanup left the generated OpenAPI document and database unchanged.
The event checkpoint adds a journal migration and the `/api/v1/events` contract. HTTP/SSR checks passed for Leads, Deals, Issues, Groups, and Roles,
including the expected toolbar text. Focused rendering coverage checks Action permission gating
and full-page replacements. Fresh interactive browser verification was blocked by the locked Mac;
earlier interactive results do not substitute for reviewing this latest UI pass.

## Decisions implemented

- Model, custom behavior, and specialized UI live under `src/modules/<domain>`. Each module has
  optional server and UI entrypoints. Composition is explicit; standard objects need no dedicated
  service or route files. `company-os/model` and `company-os/metadata` remain browser-safe exports.
- Custom Queries and Actions share contract and transport machinery but retain separate read/write
  semantics. Named `Effect.fn` functions are the default. Services represent useful dependencies;
  repositories encapsulate persistence when needed. Small aggregate SQL stays beside its operation.
- Custom methods use colon paths. Standard filtered reads use GET `list`; there is no duplicate
  search implementation. Custom structured Queries use POST, with read-only MCP metadata and the
  same client cache as standard reads.
- Contact/company and deal/company participation is many-to-many. A Contact's primary company is a
  singular selection from its memberships. Choosing a primary adds membership; removing membership
  clears that selection. Association Objects remain the choice for attributed or governed relations.
- References and Links project into one catalog with named directions. References support explicit
  inverse metadata and restrict target deletion. Ownership remains separately identified.
- Deal commercial participation is independent of its authorization parent. The migration copies
  existing company parents into business affiliations and preserves ownership, ancestry, and grants.
- Relationship pages return complete authorized target records with `objectType`. The server batches
  target hydration; the client no longer makes a second request to render that page.
- One Effect Atom request cache serves generated Queries and React through `useModelQuery`.
  Successful transactions report the types actually changed; feature code declares no mutation
  write sets. Caller identity and change tracking remain invocation-local across module bindings.
- The previous checkpoint's identity and asset foundation remains: configured identity verification,
  explicit administrator bootstrap, independent business authorization, governed uploads, protected
  delivery, and attachment integrity. PostgreSQL bytes supply a local default without a bucket.

## Verification

- `pnpm check`: all 20 tasks passed, including formatting, lint, types, dead code, model/storage
  validation, and boundaries across all workspace packages. The browser-safe model check covers
  33 modules in its import graph.
- `pnpm test`: 170 tests passed, including 121 application tests. Event coverage includes late
  commits, savepoint rollback through both transaction APIs, journal-write failures, immutable
  history, multi-subject visibility, permission reset, replay, and disconnected client caches. Focused PostgreSQL coverage includes
  authorized currency totals, caller isolation, conversion retries and concurrency, outer rollback,
  primary-selection integrity, and independent commercial links. The populated migration test
  replays committed SQL and compares ownership and grants before/after.
- `pnpm build`: all four application/template builds passed.
- The running OpenAPI document exposes custom Query/Action and relationship colon methods.
- The strict file-size review found no handwritten file crossing 1,000 lines; the generated route
  tree remains the sole changed TypeScript file above that threshold.

Before the latest layout/UI cleanup, interactive browser verification exercised the generated Deal form with explicit authorization
scope, created a temporary deal, and displayed its exact currency total through the module-owned
pipeline summary popover. The temporary record was removed through the governed API afterward.
Earlier checks exercised lead conversion, relationship editing, company logos, Issue attachments,
and generic module screens. These checks are development verification, not a production load test.

## Deliberate limits

This is a foundation for real operations, not a completed CRM or software factory. Next, implement
one sales/marketing or engineering operation end to end and use its workload to judge the design.

TanStack DB and live sync are deferred. The current cache is not an offline relational database;
other-client writes now arrive through authorized resumable polling while the app is visible. Business-data SSR dehydration, durable jobs, and
agent controllers are not implemented. Large GET filters remain subject to deployment URL limits.

Authorization currently uses roles, groups, and ownership scopes. Arbitrary relationship policy and
richer delegated identity remain future work. Attaching a file does not implicitly share it. Uploads
are bounded; image transformations, malware scanning, and abandoned-upload collection are not included.

Local use needs no Continual account. The current production build and identity adapters still need
configuration for another host; see [deployment](docs/runbooks/deployment.md). No universal deployment
support is claimed.

Existing forks must update removed `@company/model` imports and slash-style custom method calls,
apply committed migrations, and configure bootstrap/default-role settings deliberately. The sales
migration preserves old deal access boundaries; changing those is a separate business-policy decision.
