# Development scenarios

Use curated scenarios to review the application with connected business records and real assets.
Required system records remain in `seedSystem`; migrations and ordinary `pnpm dev` startup never
insert demo data.

From the repository root, after installing dependencies and starting local PostgreSQL:

```sh
pnpm --filter company-os db:migrate
pnpm db:seed --scenario demo
pnpm dev
```

The demo adds Northstar Robotics, its contacts, a sales opportunity, notes, activities, a support
request, and the linked engineering issue and pull request. Other companies demonstrate multiple
associations, long names, missing images, and different lifecycle states. Marketing records include
opted-in, opted-out, and non-marketing contacts. Addresses use reserved `.test` domains. Scenarios
create records only; they do not send messages, publish content, or run integrations.

## Pagination and scrolling

```sh
pnpm db:seed --scenario performance
# Or choose the number of contacts, leads, and notes in a fresh development database:
pnpm db:seed --scenario performance --size 5000
```

The default size is 1,000; the supported range is 1–10,000. A size of N creates N contacts, N leads,
N notes, approximately N/10 companies (at least two), and N/4 support tickets (rounded up). At least
half the contacts and their notes belong to **Scale — Atlas Operations**, giving its relationship
tabs several pages of results. Every tenth contact has another company association. Names,
statuses, nullable values, consent, markdown length, and image presence vary deterministically.
The image fixtures are reused, so this profile measures record and relationship volume, not a
worst-case library of thousands of distinct images.

Use All contacts or All leads to exercise table scrolling and pagination. Open Scale — Atlas
Operations to review its Contacts, Notes, and Tickets tabs. Use the marketing audience views to
exercise filtering. Counts include any records that were already in the database.

## Reruns and failure behavior

Each scenario has one durable receipt in `seed_runs`. All of its records, links, assets, events,
and the receipt commit in one transaction. A failure rolls everything back. Concurrent seed runs
are serialized. A completed scenario is skipped on rerun, preserving manual edits, removed links,
and deleted records. No record is matched or overwritten by its display name.

Changing a completed scenario's size is rejected. Use a fresh development database to regenerate
it, or use the existing explicitly confirmed local reset procedure when the whole database is
expendable. There is no automatic reset or delete-and-reseed mode. Changes to fixture code do not
patch an already completed scenario; develop against a fresh database when reviewing new fixtures.

## Adding a scenario

Place fixture builders beside the module's server code, such as
`src/modules/sales/server/demo-seed.ts`. Use ordinary named `Effect.fn` functions that call
`ModelImplementation` services and return the records needed by other builders. Link records
through the governed relationship catalog, using the traversal that owns writes. Required
identity bootstrap is separate; demo users use the existing trusted provisioning operation.

Compose builders explicitly in `src/server/seeds/<name>-scenario.ts`:

```ts
export const exampleScenario = {
  name: "example",
  parameters: {},
  run: Effect.gen(function* () {
    const customer = yield* seedSalesDemo()
    const engineering = yield* seedEngineeringDemo(customer)
    yield* seedSupportDemo(customer, engineering.issue)
  }),
} satisfies SeedScenario
```

Register the scenario in `tools/db-seed.ts`. There is no filesystem discovery, model hook, or
mandatory seed implementation for every module. `runSeedScenario` supplies the transaction-bound
application services and trusted system invocation. Builders must use those services rather than
opening their own connections or starting external work. The rollback guarantee currently includes
asset bytes because the standalone BlobStorage stores them in the same PostgreSQL transaction;
an external blob adapter would need a separate cleanup strategy before being used here.

Use `importSeedAsset(fileUrl, scope, contentType)` for checked-in files. It uses the normal upload
reservation, content inspection, and completion flow and returns an ordinary asset reference.
Identical bytes with the same filename and authorization scope reuse an existing completed asset,
including across scenarios. Attach that reference through the object's normal image or file field.
Demo artwork includes editable SVG sources and PNG upload fixtures; seeding works offline and
needs no image-generation or conversion dependency.

Keep focused test fixtures small. Tests can reuse builders in isolated databases, but should not
load the whole demo for unrelated assertions. The performance size is configurable so pagination
checks need only enough records to cross a page boundary.

## Hosted development databases

The command accepts dedicated local PostgreSQL databases. It refuses production mode and system
databases. For a remote development branch, explicitly identify the destination:

```sh
CONFIRM_DEVELOPMENT_DATABASE=branch-host/database pnpm db:seed --scenario demo
```

Set `DATABASE_URL` through the normal environment configuration; do not put credentials in command
arguments. The confirmation must match its hostname and database name exactly. This acknowledgment
cannot prove that a remote database is disposable: provisioning must select a development branch.

A schema-only branch can run the same migrations and scenarios. A production-data branch is a
separate workflow and should not automatically receive synthetic data. Database receipts are copied
with a branch, so scenarios already present in that branch remain skipped. Database branching,
masking, provider sandboxing, and branch cleanup remain provisioning responsibilities; these
source-owned seed functions depend only on the configured application services.
