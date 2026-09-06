# Next foundation checkpoint: reactive data and durable operations

Status: proposed, not implemented. Based on the current Company OS code, installed Effect
4.0.0-beta.107, the local Effect checkout at 4.0.0-rc.112, and current primary documentation.
This is a review/implementation plan, not a new repository convention or dependency commitment.

## Recommendation

Keep PostgreSQL and governed model operations authoritative. Use Router loaders to coordinate
navigation and one shared data layer for records. Evaluate TanStack DB as that record layer through
a bounded engineering slice; do not build a proprietary client database or full sync engine.

Before enabling unattended agents, add durable change publication, persisted work, idempotent
external effects, and a separately runnable worker. Use keyed reconcilers for ongoing business goals,
with events and schedules waking them. Durable workflows can execute bounded multi-step work within
that architecture. Prove the design with engineering delivery before generalizing it to other domains.

## Current evidence

- `src/data-client.ts` caches request results with Effect Atom, deduplicates queries, tracks derived
  dependencies, and invalidates object types. It is not a normalized collection store.
- `src/app-client.ts` consumes `x-model-changes` from successful responses. Another browser, a webhook,
  or a background agent does not deliver this header to already-open screens. The authenticated shell now also consumes the durable event feed, catching up after disconnect.
- `src/ui/model/object-routing.ts` preloads through the same semantic client. These helpers explicitly
  skip the server. `use-model-query.ts` returns an initial server snapshot: authenticated record SSR
  dehydration is not implemented.
- Committed EventJournal subjects supply both immediate request-local invalidation and durable
  authorized cursor replay. There is one transactional change source; see `docs/events.md`.
- `Action.idempotent` is contract metadata. Lead conversion separately implements repeat safety through
  durable conversion state and concurrency checks. There is no universal external-operation ledger.
- Engineering currently has an Issue object and editor. It has no durable agent execution, GitHub
  synchronization, approvals tied to revisions, or controller worker.
- Production currently builds a request-serving worker artifact. A long-lived background process
  needs an explicit execution/deployment boundary; an Effect fiber forked from an HTTP request is
  insufficient. See `docs/runbooks/deployment.md`.

## 1. Settle the read path with an engineering screen

The responsibilities are complementary:

| Layer             | Responsibility                                                   |
| ----------------- | ---------------------------------------------------------------- |
| `beforeLoad`      | Establish route context and access prerequisites                 |
| `loader`          | Start the page's essential reads early and in parallel           |
| Shared data layer | Own record state, subscriptions, freshness, and optimistic edits |
| React components  | Observe shared queries; initiate optional reads when needed      |
| Model Actions     | Authorize and commit mutations                                   |

Router's own cache is route-oriented and lacks shared caching between routes. Its documentation
explicitly supports external caches. Do not add a serial module `beforeLoad` chain or force unopened
tabs and menus to load with every navigation. A page may export ordinary query definitions and a
loader function for its route to call. A module-wide dependency injection or loader registry is not
needed. [Router loading](https://tanstack.com/router/latest/docs/guide/data-loading),
[external caches](https://tanstack.com/router/latest/docs/guide/external-data-loading).

TanStack DB is the preferred candidate because its collections and live queries fit shared records
and linked interfaces. Begin with on-demand Query Collections over the existing authorized client.
TanStack Query can be the adapter's request machinery; feature code should not choose between Atom,
Query, and DB as competing stores for the same records. Keep aggregate reports as server Queries;
a local count of a partially loaded collection is not a global business total.
[TanStack DB](https://tanstack.com/db/latest/docs/overview),
[Query Collections](https://tanstack.com/db/latest/docs/collections/query-collection).

The integration must prove:

- Issue list, detail, and board share canonical identities and update together.
- Assignee references and the existing Contact–Company Link work without per-screen stores or full
  table downloads. Load only authorized subsets and avoid label prerequisites blocking the base view.
- Model-derived types are reused; business schemas and validation are not independently rewritten.
- Filters, sorting, pagination, and subset replacement preserve server semantics. Current DB subset
  requests include cursor expressions as well as offset/limit; these are not our opaque page tokens.
  The adapter must translate supported requests correctly and reject unsupported semantics rather
  than return plausible partial results. [Subset contract](https://tanstack.com/db/latest/docs/reference/type-aliases/LoadSubsetOptions).
- Ordinary edits can be optimistic, roll back on rejection, and reconcile canonical server values and
  etags. Concurrent updates cannot overwrite newer results. A custom Action still runs on the server;
  an optimistic UI transaction is not proof of a committed database transaction.
- Route preloads and component reads use the same data. Use request-scoped server clients and one
  browser client per identity; hydrate only authorized data. Never cache one caller's records in a
  server module singleton. Current DB docs describe request-scoped clients and explicit hydration.
  [SSR and hydration](https://tanstack.com/db/latest/docs/guides/ssr).
- Identity changes and access revocation clear affected cached data. Reconnection refetches the active
  subsets and restores their membership and order.

Adopt DB broadly only if this is a small shared adapter plus understandable feature code. If it
requires a second query planner, many casts, endpoint-specific collections, or fragile cursor state,
keep the existing Atom cache for the first application. Either way, add cross-writer freshness. Do
not extend the Atom cache into a homegrown relational database while also experimenting with DB.

## 2. Add durable change and execution boundaries

### Change publication and live UI

Implemented for standard writers and explicit custom facts: transactional EventJournal,
commit-ordered cursors, authorized replay, and visible-browser polling with reconnect recovery.
See [Durable events](docs/events.md) for the current guarantees and limitations. The journal also
serves as the outbox; future deliveries reference its events instead of duplicating payloads.

A future row replication protocol still needs snapshot consistency, canonical upserts, tombstones,
transaction batches, and rows entering/leaving filtered windows. The current consumer invalidates
and refetches governed queries. Worker scheduling and execution below remain proposed.

### Persisted controller work

A controller receives a stable key, reloads current authorized state, and decides the next bounded
step. Events can be coalesced for scheduling because the authoritative state is reread. Preserve
business events separately where each occurrence matters. This follows controller-runtime's
level-based reconciliation model. [Controller contract](https://pkg.go.dev/sigs.k8s.io/controller-runtime/pkg/reconcile),
[Kubernetes controller model](https://kubernetes.io/docs/concepts/architecture/controller/).

Keep three identities separate:

- Reconciliation key: `(controller, record/scope ID)`; reusable over the lifetime of an Issue.
- Run ID: one execution attempt, with inputs, result, timings, budget, and error evidence.
- External operation ID: one intended side effect, stable across retries of that effect.

Required behavior: deduplicated pending work, retriggering while running, bounded concurrency,
leases, fencing of stale workers, backoff, scheduled wakeups, terminal failure visibility, retry,
and cancellation. Do not hold a SQL transaction open around a model call or provider request.
Lease exclusivity alone cannot prevent every duplicate external effect after a crash or pause.

Effect's installed `PersistedQueue`, `Workflow`, and `DurableQueue` are candidates for execution
mechanics. The local RC checkout is newer and must not be treated as the installed API. Validate
transaction participation, crash recovery, and cancellation against the pinned version before
adopting it. Queue ID deduplication is not sufficient for a reusable controller key: a completed ID
can suppress later wakeups, while an event arriving during a run must leave work pending.

Prefer existing persisted execution primitives where they fit. A small company-owned scheduling
record may still be necessary for requested/processed revisions and keyed coalescing. Do not add a
custom workflow interpreter or distributed cluster merely to represent the first controller.

Run workers independently from HTTP requests, using the same central application's model, policy,
and service composition. Start with a local worker command and one production worker deployment.
This requires choosing a worker host, not redesigning Continual's platform or creating another
business authority. Before running code-writing agents, select a bounded external/sandboxed executor;
the web/API process should not be their workspace.

## 3. Prove it through engineering delivery

### Integration authority and effects

Treat inbound synchronization, outbound effects, and browser freshness as separate mechanisms.
For GitHub, start with explicit ownership:

| Fact                                                                              | Authority  |
| --------------------------------------------------------------------------------- | ---------- |
| Business requirement, assignment policy, automation intent, approval policy       | Company OS |
| Git commit identity, PR head, provider check results, merge observation           | GitHub     |
| Agent attempt, proposed action, execution evidence and external-operation receipt | Company OS |

For every shared field, decide which side owns it or how conflicts are resolved. "Bidirectional sync"
is not a conflict policy. Use provider/account-scoped external IDs, source revisions where available,
observed timestamps, and correlation IDs. Existing aliases can identify external records; delivery
state, checkpoints, and operation receipts need their own persistence.

Inbound: verify webhook, durably record delivery identity, acknowledge, normalize/update observations,
and enqueue affected keys. Tolerate duplicates and reordering. Periodic reconciliation repairs missed
webhooks or external drift. GitHub documents delivery identifiers, asynchronous handling, and missed
webhook redelivery. [Webhook practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks).

Outbound: a governed Action commits intent; a worker invokes the provider and records the observed
result. Use provider idempotency when available. If success occurs externally but the response is lost,
look up the correlated result before retrying. Where that cannot be established, expose an ambiguous
state for repair instead of claiming exactly-once delivery. Recheck authority and approval when an
operation executes, not only when it was enqueued.

### First controller

Use a software-delivery goal to connect Issue, CodeChange, AgentRun, provider Checks, and Review or
Approval. These are candidate business concepts, not a schema to generate wholesale before the flow
is designed. Keep GitHub credentials and payload handling inside a provider adapter.

For example, key `engineering.issue-delivery` by Issue ID. On a wakeup, reload the Issue, its active
change, the exact code revision, check results, and applicable approval. Start at most one valid next
attempt, wait for an external result or human decision, or record that no work is needed. Changes to
an owned CodeChange or Run map back to the Issue key. Do not poll every company record or launch a
new model invocation on every status/log event.

Agents supply bounded judgment: triage, planning, implementation, and proposals. Deterministic Actions
remain responsible for permission checks, state transitions, concurrency, and evidence requirements.
Use a scoped ServiceAccount; reserve system authority for infrastructure that actually needs it.
Persist desired intent and observed progress separately. Run transcripts are evidence, not the
source of truth for whether a PR exists, an approval applies, or delivery completed.

A durable workflow is useful for an ordered attempt such as provision workspace → run agent → collect
artifacts. The controller decides whether the current business state still requires that attempt.
Bind approvals and checks to the exact relevant revision and intent; a newer commit invalidates an
older approval where policy requires it. Budget time, tool calls, and spend; make failures and pending
human decisions visible in the same application.

### Acceptance evidence

- A change made by the agent becomes visible in another open browser without focus refresh.
- Duplicate webhooks and a worker crash after an external success do not create duplicate intended PRs.
- A change during reconciliation reliably produces another pass; a completed run does not disable the key.
- A stale worker cannot commit a superseded decision, and cancellation prevents new work from starting.
- A new code revision cannot reuse an approval for a previous revision.
- Restarting the worker resumes or repairs work from durable records rather than restarting a chat.
- Most feature changes stay in the Engineering module and provider adapter.

## Explicitly defer

Full offline replication, CRDT conflict resolution, arbitrary client SQL pushdown, a visual workflow
builder, a generic connector marketplace, a Kubernetes object model for all records, multi-runner
sharding, and a broad autonomous company agent. Preserve clean boundaries for these; implement only
what the first real operation demonstrates it needs.
