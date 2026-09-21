# Development

[Back to the README](../README.md)

Before v1, build against the current model and reset disposable development data. Update contracts
and their callers together; backward compatibility is not a pre-release requirement.

| Command                      | Purpose                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `docker compose up -d`       | Start local PostgreSQL 18 + pgvector on host port 5433                          |
| `pnpm dev`                   | Generate the schema, prepare the database, seed the demo once, and run the apps |
| `pnpm reset`                 | Rebuild disposable local storage and restore the demo                           |
| `pnpm db:generate`           | Refresh `schema.sql` from the model without accessing a database                |
| `pnpm db:migrate`            | Apply pending migrations and ensure system records and search                   |
| `pnpm db:seed`               | Prepare the database and load demo records once                                 |
| `pnpm check`                 | Lint, typecheck, generated schema/model checks, formatting, and dead code       |
| `pnpm test`                  | Test application behavior against the current model                             |
| `pnpm build`                 | Build the apps                                                                  |
| `pnpm format`                | Format the repository                                                           |
| `pnpm ui:add <component>`    | Add a shadcn primitive to `packages/ui`                                         |
| `pnpm ui:remove <component>` | Remove an unused primitive                                                      |

**Lint rules:** [`.oxlintrc.json`](../.oxlintrc.json) configures linting for every
workspace. Custom rules live in [`tools/oxlint`](../tools/oxlint), under the `repo/`
plugin prefix (`repo` means this repository):

- `filename-case`: kebab-case filenames, with framework naming conventions.
- `import-boundaries`: keep the runtime independent of business modules, module
  implementations private, models portable, and browser code free of server imports.
- `no-internal-reexports`: named re-exports only at explicit public entrypoints;
  no wildcard barrels.

All rule tests live in [`tools/oxlint/tests`](../tools/oxlint/tests). Its `fixtures/`
directory contains valid and deliberately invalid example code. `rules.test.ts` runs
Oxlint against those examples with the test-only `oxlint.json` configuration, which
enables only these custom rules so unrelated lint rules cannot affect the assertions.
Fixtures are excluded from normal linting, typechecking, and test discovery. Run
`pnpm --filter @company/tools test` to check the rules, or `pnpm check` to lint the workspace.

**Getting started:** run `docker compose up -d` for PostgreSQL 18 on host port 5433, then use
`pnpm install` and `pnpm dev`. Turbo runs schema generation, migrations, and demo seeding
before either app starts. The local database is created if missing. Subsequent starts preserve
existing records and your edits to the demo.

**While building:** ordinary application changes use Vite's live reload. After storage model
changes, stop dev, run `pnpm reset`, and restart `pnpm dev`. A changed pre-release schema stops
startup with a reset instruction; startup never resets existing data automatically. Reset discards
the configured local schema's data, restores system records, search, and demo records, and refuses
remote hosts and PostgreSQL system databases. Use `pnpm db:generate` to refresh only the checked-in
SQL without touching data. Pending migrations are applied at startup, not on every hot reload.

**Larger datasets:** `pnpm db:seed --scenario performance --size 1000` adds performance fixtures;
`--scenario all` runs both scenarios. Each scenario runs once per database and preserves later edits
and deletions. Reset before changing the performance dataset size. Automatic demo seeding is for
local development; remote seeding requires an explicit target acknowledgment.

**Before delivery:** commit the model, generated `schema.sql`, and relevant tests together. Do not
add incremental migrations or backfills for disposable pre-release data. Keep one model-derived
initial migration. Reset drops disposable storage and reapplies it through the same Effect SQL runner
used by `pnpm db:migrate`. Migration and reset tests run in `pnpm test`.

**Retained data:** follow the [deployment guide](deployment.md). Pre-release reset policy does not
authorize deleting remote or explicitly retained data. When retained-data upgrades become necessary,
freeze migration 1's SQL and add immutable numbered migrations to the app-owned registry. The runner
already supports pending migrations; the generated schema remains the expected final structure.
Revisit compatibility guarantees before v1.

Database tests need a PostgreSQL role with `CREATEDB`. Scratch databases
are removed afterward. Tests default to `postgresql://localhost:5433/postgres`; commands use the
application's configured connection. After changing the database environment,
`pnpm turbo run test --force` bypasses cached test results. For inspecting a retained database,
`pnpm --filter company-os db:dump` writes an ignored `schema.actual.sql` using `pg_dump` (the
server's major version or newer).

### Agent controllers

`Agent.run` awaits one turn. Each controller/key owns one persistent agent session,
provided by the controller runtime through `AgentSession`. Without `outputSchema`, a run
returns `void`; with an Effect Schema, it returns decoded, validated output. Events that
arrive during a turn queue the next reconciliation. Interruption requests cancellation;
it cannot undo tools already executed.

```ts
const agent = yield * Agent
// Inside a controller reconciliation; the agent can read and write through MCP.
yield *
  agent.run({
    input: `Research contact ${contactId} and update their summary using Company OS tools.`,
  })
```

The CRM contact-summary controller follows this pattern: Codex reads the current contact,
related records and notes, optionally researches public sources, and writes the summary
itself. Source changes enqueue another run. Its `ignoreUpdates: ["summary"]` definition
ignores updates that write only that property, preventing feedback from its own writes.
Mixed updates still trigger it. In the UI, open a contact to view the summary and its
controller diagnostics or run it manually. Codex sessions have no desktop link: opening
one in desktop can claim its writer lock and prevent the controller from resuming it.

`CodexAgent.layer(client, threadOptions)` accepts the native SDK client and native thread
options. Application configuration lives in `src/app/server/agent.ts`:

```ts
const client = new Codex({
  config: {
    mcp_servers: {
      company_os: { url: companyOsMcpUrl, required: true },
    },
  },
})
const agentLayer = CodexAgent.layer(client, {
  workingDirectory,
  skipGitRepoCheck: true,
  sandboxMode: "read-only",
  approvalPolicy: "never",
  webSearchMode: "live",
})
```

The Node application defaults to a scratch directory and `COMPANY_OS_MCP_URL` (default
`http://localhost:3002/api/mcp`). Codex inherits local CLI authentication and configuration.
For a protected deployment, configure MCP credentials accepted by the application's identity
provider using native SDK configuration; a URL alone does not grant project admission
([MCP configuration](https://developers.openai.com/codex/mcp)). The filesystem sandbox does
not remove the MCP identity's business access.

The controller database stores the provider thread ID and user-facing URL. Codex stores
conversation history in its configured home directory; retain both across restarts.
The controller runtime serializes reconciliation for each key. The adapter adds no separate
session store or locks. `idempotencyKey` is optional and ignored by Codex: retries can repeat
tools. Structured output uses Effect's OpenAI schema converter and validates the response
locally; unsupported schemas fail before a prompt is sent.

### External agent tests

`pnpm test` runs adapter unit tests and controller database tests without calling providers.
Use native SDK instance spies for transport events, and fake the `Agent` service for
controller behavior. Assert state transitions, session reuse, routing, and cancellation;
avoid exact prose or prescribed tool sequences. Recorded responses can be fixtures, but
do not establish live provider compatibility.

Live tests are a separate, explicit Vitest project:

```sh
pnpm --filter company-os test:agents:live codex-live
pnpm --filter company-os test:agents:live continual-live
```

The Codex test starts an isolated database and a loopback HTTP MCP server, then runs the
real contact-summary controller with local Codex CLI authentication. It checks that Codex
reads a synthetic note, saves a summary through MCP, and refreshes after the note changes
using the same thread. It needs PostgreSQL with `CREATEDB`, but no running Company OS app.
The scratch database and HTTP server are cleaned up; the Codex conversation remains.

Continual requires `CONTINUAL_URL`, `CONTINUAL_PROJECT_ID`, and `CONTINUAL_API_KEY` for a test
Project; it leaves a completed test Thread. These tests incur provider usage and run without
Turbo result caching. The Continual test checks SDK execution and persisted results; a
Continual `Agent` adapter still needs an SDK API for running another turn in an existing
session.

## Application structure

Business code lives in `apps/company-os/src/modules`; the kernel is in `src/runtime` and the shell
in `src/app`. `app.model.ts` composes every module. Administrators explore and enable modules in
Settings > Platform > Modules. Activation is stored in the database and controls UI, HTTP, and MCP,
leaving disabled modules' data intact. Platform is always enabled. Enabling a
module also enables its dependencies; turning one off asks you to confirm any dependent modules. Newly added optional modules
start disabled on existing installations; an initial setup enables all installed modules.
Change product identity and the entry experience in `src/app/customization`.

[AGENTS.md](../AGENTS.md) holds repository conventions. The skills point to working source examples;
code, tests, and generated contracts define the implementation. `apps/client-portal` is an optional
satellite over the central app's API; delete it if unnecessary or copy it for another interface.

### Actions and Queries

An Object defines a business record's properties; a Record is one instance. Links connect records,
with `from.object` and `to.object` naming the allowed Objects or Interfaces. Capabilities attach to
an `object` generally or a particular `record`; filters and batches remain explicit inputs.

Objects generate `get`, `list`, `batchGet`, `create`, `update`, `delete`, and `batchDelete`.
Disable standard writes with `actions: { delete: false }`; disabling delete also disables batch
deletion. Custom operations are standalone `defineAction` or `defineQuery` definitions, registered
once in their owning module's `actions` or `queries` array.

```ts
export const EscalateTicket = defineAction({
  id: "escalate",
  record: Ticket,
  name: "Escalate to engineering",
  description: "Creates an engineering task for an open support ticket.",
  input: { id: schema.id(Ticket) },
  output: { task: schema.id(Task) },
})
```

`record: Ticket` requires an explicit, non-nullable `input.id: schema.id(Ticket)`.
`object: Ticket` attaches to the Object and adds no parameters. Omit both for a global
operation. The module owns activation and implementation; the attachment controls discovery and
placement. An extension module can attach an operation to another module's Object.

| Attachment    | HTTP                                 | MCP               | Client                           |
| ------------- | ------------------------------------ | ----------------- | -------------------------------- |
| Ticket record | `POST /api/v1/tickets/{id}:escalate` | `ticket.escalate` | `client.ticket.escalate({ id })` |
| Ticket object | `POST /api/v1/tickets:summary`       | `ticket.summary`  | `client.ticket.summary({})`      |
| Global        | `POST /api/v1/:reconcile`            | `reconcile`       | `client.reconcile({})`           |

Custom Queries also use POST with a structured body. Record IDs go in the HTTP path; MCP and the
semantic client retain them in the explicit input. `schema.id` accepts canonical IDs or qualified
aliases on input and emits canonical IDs on output. Module names do not appear in public operation
names. Composition rejects duplicate names and collisions with standard methods or Link traversals.

`defineModuleServer(Module, { operations, controllers, layer })` is the module's server entrypoint.
Its `operations` map mirrors the client: `{ ticket: { escalate } }`, or `{ reconcile }` for a global
operation. Its `controllers` array binds controller definitions to their handlers. Omit unused
contributions; `layer` optionally supplies Effect services used by either kind of handler. Register
this one entrypoint in `app.server.ts`'s `serverModules` array. The shared model remains browser-safe;
server handlers retain their inferred Effect service requirements, checked when composing the app.
Actions run in a transaction. Queries run read-only and
cannot call writers or Actions, or join a write transaction. Within an Action, read through `Database.repository(Object)`
in the same transaction. Business operations still own admission checks, validation, invariants,
and external-effect failure handling; read-only execution does not sandbox external services.

The browser-safe model owns definitions. `runtime/contract/operations.ts` resolves complete schemas
once per composed model; HTTP/OpenAPI and MCP project that catalog. UI uses the active model and the
shared semantic client/cache. Record and collection Actions get schema-driven forms unless replaced
by a custom control. `useClient(Model)` exposes every object and custom operation through
`queryOptions(input)`, `mutationOptions()`, and collection `infiniteQueryOptions(input)` factories;
pass these directly to TanStack Query hooks. `OperationAction` can place a global Action on a module page. Queries provide typed cache
options for views, without inventing a visualization from their output schema.

### Vocabulary

Use one name for each concept in code, documentation, and generated API descriptions:

| Concept                                 | Name             | Example                                         |
| --------------------------------------- | ---------------- | ----------------------------------------------- |
| Business data definition                | Object           | `Account`, represented by `ObjectType`          |
| An instance of an Object                | Record           | Northstar Robotics                              |
| A modeled connection between records    | Link             | `AffiliationAccount`, represented by `LinkType` |
| One named direction through a Link      | Traversal        | `account.affiliations`                          |
| The identity of a record                | Record reference | `RecordRef`: `{ objectType, id }`               |
| A value exposed for display or querying | Field            | `name`, `account.name`, `affiliations.$count`   |

A Property is a value declared on an Object; a Field can also expose standard record values,
Link values, or values reached through a Link (`RelatedField`). `recordProperties` defines the
standard record properties. Use `ObjectType` directly rather than introducing synonyms;
`ModelObject<M>` specifically means the Object types in model `M`.

Use `links` for Link configuration and record values, and `link` / `unlink` for operations.
`LinkTraversal` describes a direction; `ModelLinkTraversal.inverse` is its opposite traversal.
`RecordLinkView` supplies a record's traversal with UI labels, queries, and operations.
Selectors choose records (`RecordSelect`, `RecordMultiSelect`). User-facing sections say
**Related records**; developer tools say **Links**. Reserve “relationship” for business language,
such as a contact's relationship strength. Foreign keys and join tables are storage details.

### Links

Declare every link once with `defineLink`; both directions use the same stored edge.
Scalar properties contain values. `schema.id` is for Action and Query inputs or outputs,
not stored links.

```ts
const DealOwner = defineLink({
  id: "dealOwner",
  name: "Deal owner",
  from: { object: Deal, key: "owner", label: "Owner", max: 1 },
  to: { object: User, key: "ownedDeals", label: "Owned deals" },
})
```

Links support optional singular (`max: 1`), required singular (`min: 1, max: 1`),
and optional unbounded plural traversals (no bounds). At most one end can be required.
Singular references use foreign keys; many-to-many associations use join tables. Both
traversals address the same link. `uniqueBy` can combine ordinary fields with
references stored on the object's own table; it cannot impose uniqueness through joins.

Get, list, and batch-get return scalar properties alongside `objectType` and `links`:

```json
{
  "id": "deal_…",
  "objectType": "deal",
  "name": "Expansion",
  "links": {
    "owner": "user_…",
    "companies": {
      "ids": ["company_…"],
      "totalSize": 1,
      "totalSizeExact": true
    }
  }
}
```

Singular links return an ID or null. Plural links include at most three IDs and a count;
use the traversal's paginated `list` operation for the complete collection. Request
`expand: true` or a map such as `expand: { owner: true }` to hydrate one hop. Alternatively,
use `records.batchGet({ ids })` (HTTP `POST /api/v1/records:batchGet`, MCP `records.batchGet`).
It deduplicates input, preserves input order, and returns `missingIds` for missing or
inactive records.

Create accepts `links: { owner: userId, companies: [companyId] }`. Update accepts singular
IDs or null, plural arrays to replace the whole set, or `{ add, remove }` for partial edits.
Required references must be supplied at creation and replaced directly; they cannot be
cleared temporarily, even inside a transaction. Linking a second target to a singular
link fails; use explicit replacement. Record and link changes, search
updates, and journal events commit together.

Ownership is a link traversal with `onDelete: "cascade"`; its opposite direction must have
`max: 1`. Deleting the source then deletes its linked targets. The default only removes edges,
and fails if surviving records would lose a required link. Unlinking never deletes
records. `outputOnly: true` reserves a link for trusted Actions and removes public mutation
operations in both directions. Use an Object when an association needs properties,
Actions, or a lifecycle.

`acyclic: true` prevents cycles in a Link between records of the same concrete Object.
PostgreSQL validates the final graph at transaction commit, including writes through either
traversal and custom SQL. Validation serializes graph edits per Link; conflicting transactions
at stricter isolation levels may need retrying. Separate acyclic Links remain separate graphs.

### Work

Work uses Project for a bounded outcome and Task for an actionable unit of work. Tasks can
stand alone or belong to a project, and can decompose recursively through `parent` / `subtasks`.
Project membership is explicit on each task; nesting does not inherit membership or ownership.
Deleting a project or parent leaves its tasks intact. Owners can be users or service accounts.

`dependsOn` / `dependents` describe prerequisites independently of decomposition, including
across projects. Both graphs reject cycles. Status records the task's explicit lifecycle position;
there is no separate readiness field or automatic execution policy. The Waiting on dependencies
view shows unfinished tasks with prerequisites that are not done. This filter does not restrict
status changes or start work automatically. Completion remains an explicit decision supported
by completion criteria, notes, and attachments. Parent completion does not roll up automatically.

Planned start and finish dates describe the schedule; due date is a separate deadline. Repeated
operations create separate task records. Production orders, materials, inventory, product
revisions, and resource capacity belong in business modules that link to Work when needed.

### Collection views

Author collection views with `defineCollectionView(Model, Object, id, label, options)`.
The composed model supplies typed Link paths alongside the Object's properties. Columns retain
a single ordered `columns` list across table and card layouts; the table's selection and identity columns
remain pinned. Filters check field names and enum values, sorting excludes plural previews,
and schedule mappings accept date fields. Authored filters must be complete and valid; only live
filter controls may contain unfinished input. Authored definitions also validate at runtime;
user-edited URL state and public queries retain their runtime validation.

### Page spacing

Compose layouts with `PageHeader`, `PageToolbar`, `PageContent`, and `PageSectionHeader` from
`@company/ui/page`. Headers and content share a 16px gutter; toolbar rows are at least 48px and
grow when controls wrap. Content sections are separated by 24px. `PageHeader.navigation` owns the
bottom divider alignment; use `TabsList variant="header"` there without tab spacing overrides.
The containing page or panel owns padding once, so custom tab content must not add another outer
gutter. Tables remain edge-to-edge. Sidebar rows use 8px outer plus 8px inner padding, aligning their
content at 16px; their compact row rhythm is independent of page toolbars. Cards and controls own
their internal spacing. Use `p-page-gutter` directly only when a layout cannot use these components.

### Browser preferences

Use `useLocalPreference` from `@company/ui/local-preferences` for browser-local presentation
preferences. The app shell supplies `LocalPreferencesProvider` with an app and user namespace.
Each preference has a stable key, default value, and validator; change the key when its stored shape
changes incompatibly. Reads are SSR-safe, invalid values use the default, and blocked storage falls
back to the current session. Resize controls keep live interaction state and save only on completion,
keyboard adjustment, or explicit reset. Viewport constraints must not overwrite the saved preference.
Keep credentials and authoritative business data out of this store.

### Controllers

A controller keeps a target in the desired state. Its portable declaration belongs in the owning
module's `controllers` array. The matching file under `server/` implements it, and `server/index.ts`
collects controllers alongside custom operations in the module's single server contribution.

The following illustrative controller is a test fixture, not installed business behavior:

```ts
// A custom module's model/task-greeting.ts
export const TaskGreeting = defineController({
  id: "task-greeting",
  record: Task,
  schedule: { cron: "*/15 * * * *", timeZone: "UTC" },
  minInterval: "1 second",
  name: "Task greeting",
  description: "Ensures each task has a Hello world note.",
  watch: ["notes"],
})

// server/task-greeting.ts
export const taskGreeting = defineControllerServer(TaskGreeting, {
  reconcile: Effect.fn(function* (taskId) {
    // Read current records and make an idempotent change through Database.
    // Returning completes this attempt; failures are retried.
    // Optionally return { requeueAfter: "10 minutes" } to check this key again.
  }),
})

// server/index.ts
export const WorkServer = defineModuleServer(WorkModule, {
  controllers: [taskGreeting],
})
```

`record: Task` reconciles each task ID independently. `object: Task` reconciles once for the
whole installation, with `reconcile()` taking no argument. These targets determine scheduling and
where controllers appear in the UI; either controller can read or change other objects. Record handlers
use the target's branded record ID type. Object handlers take no key.

Target creation, updates, and deletion request reconciliation automatically. `watch` declares named
link paths, such as `notes` or `affiliations.account.notes`. Changes to related records or
any link along a path request reconciliation for the affected targets. Every intermediate
record is a dependency too: an account rename matters even when the path ends at its notes. Paths
are validated against the composed model; event suffixes and property names are not watch paths.

The writer captures affected keys in the same transaction as the change, including before removing
links or deleting records. The journal consumer queues these saved keys without reconstructing old
links. No `onEvent` handler is needed. An unrelated record change does not wake the controller.

`ignoreUpdates: ["summary"]` suppresses target updates that write only those properties. Mixed
updates still trigger, and link changes are independent. This is a trigger filter, not field
ownership: human and agent summary-only edits are both ignored. A later input change or manual run
can update the summary again. Related-record dependencies remain independent of this target filter.
The writer uses supplied property names only while routing the write; the journal stores the resulting
controller keys, not the property list. No record-value diff or previous-state tracking is needed.
Changing watch definitions does not rewrite past events; manually rescan after changing dependencies.

`schedule: { cron, timeZone? }` adds periodic rescans alongside watches. The time zone defaults to UTC.
ClusterCron persists scheduled ticks and coordinates them across replicas. A tick enqueues every current
record key, or the single object key; it never calls reconciliation directly. Ticks skip disabled
modules. After downtime, an eligible overdue tick can rescan current state, then scheduling continues
from now without replaying every missed tick. ClusterCron skips ticks more than a day old.

`minInterval` optionally sets minimum spacing between attempts for each key, including event, cron,
manual, delayed, and retry wakeups. Omission adds no throttle. It uses the persisted last-start time,
so restarts preserve the limit. Events arriving during the wait coalesce into the next pass; they do
not extend the deadline as a debounce would. Failure backoff still applies independently.

A successful reconciliation may return `{ requeueAfter: "10 minutes" }`. This persists a delayed
wakeup for that key before acknowledging its current work. An event can wake the key sooner, subject
to `minInterval`. Each successful pass replaces its previous delayed follow-up; returning nothing
cancels it. Obsolete delayed messages are acknowledged without running reconciliation. Durations must
be positive and finite. Timers express earliest eligibility, not an exact execution guarantee.

Events wake reconciliation; current durable records determine what to do. A handler may read event
history as context, but must not depend on receiving every transition in a particular attempt.
Effect Cluster stores wakeups in PostgreSQL and owns keyed execution. An attempt drains the current
batch; wakeups arriving during that attempt remain for another pass. Failures retry with capped
exponential backoff. Journal progress advances only after wakeups are durably submitted. First
registration captures a journal cursor, scans current targets, and saves that cursor after the scan
is durably queued. Changes during the scan are then consumed from that boundary. An interrupted
initial scan may repeat; process restarts and module reactivation resume the saved cursor and pending
work without rescanning. Journal polling covers missed notifications. Disabling a module pauses new
attempts while preserving its pending work and cursor, so changes made while disabled are consumed
on reactivation. Use manual reconciliation when an explicit rescan is needed.

Controller diagnostics count every started reconciliation as a run, including retries. Failures count
runs that end in an error and remain counted after a successful retry. The current error count is
separate: it counts keys presently in the error state. These counters reset with the database.

Delivery is at least once. Use transactions and model constraints for database effects, and provider
idempotency keys for external effects; a process can fail after changing something but before
acknowledging its work. Different controllers have independent queues, so shared invariants still
need database constraints or explicit transactions. Agent calls are ordinary Effect services inside
reconciliation.

Definitions stay in code. System bootstrap synchronizes their metadata into read-only Platform
Controller records, linked to their owning Module. Standard list/get, links, and pages expose that
registry even when a module is disabled. Definitions are publicly read-only; only `paused` is editable through standard update. Bootstrap updates
changed definitions without resetting journal progress; removing a definition removes its registry
record and its controller instances.

Registry records have generated canonical IDs. The stable name
`system:controller:contact-summary` is an alias accepted by the normal record APIs.
Internal registration uses `Database.repository(Controller).upsert({ alias, values, links })`:
concurrent calls for an alias converge on one record, supplied values and links are
validated normally, and omitted fields and other aliases are preserved. An unchanged upsert
produces no write or event. This repository operation is internal; it does not enable public CRUD.

`client.controller.status({ id, key? })` serves HTTP, MCP, and the Controllers tabs. Without a key it
aggregates diagnostic state; with a key it reports that key, including `notStarted` if unseen.
`requeueAt` reports the requested delayed follow-up (the earliest across keys for aggregate status);
actual execution also depends on throttling, backoff, and availability.
Both status and reconciliation accept target aliases and resolve them to canonical queue keys.
`enabled` derives from module activation; `paused` is independent operator configuration. State is the last recorded observation, not a
host-health signal. Runs include retries; individual run history is not retained. Consumer cursors
and Cluster queues remain internal. See [deployment](deployment.md#controller-hosting) for host requirements.

Per-key state is stored in publicly read-only `ControllerInstance` records. Each instance links to
its Controller and, for record controllers, its target record. Record targets implement the
`ControllerTarget` interface. Standard list/get, expansion, link previews, and pages expose
state, run and failure counts, timestamps, errors, and the agent session reference. The record header
summarizes these instances; the Controller instances link tab exposes the full list.
`client.controllerInstance.reconcile({ id })` runs a particular instance through the same queue.

`client.controller.reconcile({ id, key? })` durably requests another pass through the same keyed
queue. Omit `key` to scan all current records of a record controller or wake the single object
key. The Controller detail page and object Controllers tabs provide the same action. Acceptance
commits an attributed `controller.reconciliationRequested` event against the Controller record; it
does not wait for execution and works while the host is stopped. Disabled controllers reject new
manual requests. Requests may coalesce. To check idempotency, wait for completion, trigger again
without changing business data, and verify that the result stays the same. The runtime guarantees
scheduling, not idempotent effects.

`client.controller.update({ id, paused: true })` pauses the whole controller. Admission is serialized
with pause updates: an admitted attempt may finish, but later attempts wait. Watches keep recording
pending work while paused; cron and manual requests use that same queue. Resume with `paused: false`
processes retained work without an extra scan. Registration and process restarts preserve pause state.
The UI derives applicable definitions from the model and exposes Run now and controller-wide pause/resume.

Module registry records also use generated IDs and stable aliases (`system:module:work`).
Registration uses the normal repository upsert and preserves existing activation choices. Controller-to-module
Links resolve these aliases rather than constructing primary keys.
