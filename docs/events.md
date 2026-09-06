# Durable events

Company OS owns an append-only PostgreSQL journal. Business tables remain authoritative; the
journal records committed facts and supplies replay to independent consumers. It requires no
Continual service, broker, or separate worker for browser updates.

## Follow a write

1. A governed Action validates input, checks permissions, and writes through model writers.
2. Object writers stage `created`, `updated`, and `deleted` facts. Link writers stage actual
   `linked` and `unlinked` changes, including primary replacement and deletion cascades. Repeating
   an existing Link does not produce another event.
3. `Database.transaction` keeps a separate event buffer for each savepoint. Successful inner
   transactions merge their events; rollback discards them.
4. Immediately before the outer commit, the database allocates journal positions and inserts
   the events. A single counter row stays locked until commit. This makes committed positions
   safe to consume in order even when concurrent transactions finish out of order.
5. After commit, the event subjects determine HTTP cache invalidation. There is no separate write-set
   or rollback tracker. Other open browsers discover the same facts through the authorized event feed.

Events and business writes commit together. A process crash before commit leaves neither;
a crash after commit leaves the journal available for replay. Position allocation serializes the
short final journal flush, not the preceding business operation. Large transactions hold that lock
longer. Do not execute network effects or additional business writes after allocating positions.

## Add a business fact

Declare its portable contract beside the owning Object in `modules/<domain>/<object>/model.ts`:

```ts
export const LeadConverted = defineEvent({
  type: "lead.converted",
  version: 1,
  subject: Lead,
  data: schema.object({
    company: schema.reference(Company),
    contact: schema.reference(Contact),
  }),
})
```

Register its fact schema in the application's `src/events.ts` union. That union validates facts before
persistence; the shared envelope is added to derive the generated HTTP client and OpenAPI. Standard Object and Link event types derive from
the model automatically; they need no registration. Keep older payload versions readable when a
contract changes. See the executable Lead conversion for the complete example.

Inside the Action's existing database transaction:

```ts
const events = yield * EventJournal
// Write and authorize the conversion first, then:
yield *
  events.append(LeadConverted, {
    subject: lead.id,
    data: { company: company.id, contact: contact.id },
  })
```

`append` validates against the installed event contract and takes an immutable copy of the payload.
It derives related subjects from semantic reference and file fields, including nested arrays,
maps, and unions. Optional `related` IDs add further visibility constraints for sensitive context
that the payload schema cannot express. Every subject must be readable to receive the full event.
Use semantic reference fields for identifiers, not untyped strings that bypass this protection.
Append outside `Database.transaction` fails; it never silently creates an independent transaction.

The server derives actor identity from the invocation. Consumers cannot submit an actor or create
journal records over HTTP. Events carry stable IDs, transaction IDs, versions, subjects, actor,
occurrence time, and recording time. Standard change events omit record snapshots and field values.
A custom SQL mutation must preserve normal write invariants and append an appropriate declared
fact covering its affected records in the same transaction. Raw SQL is not intercepted. Bootstrap
seed upserts are intentionally outside the runtime event history.

## Consume the feed

The generated application client exposes `listEvents`; the HTTP endpoint is `GET /api/v1/events`.
For example, these are query parameters, not custom mutation routes:

```ts
const page = yield * listEvents({ cursor, pageSize: 100 })
// Process page.items successfully before persisting page.nextCursor.
```

- Omit `cursor` to replay retained history; `cursor: "now"` begins at the committed head.
- Optional `type` selects one exact event type. A cursor is bound to its caller and filter.
- Always keep `nextCursor`, including on empty pages. `hasMore` means immediately request another
  page. Page size bounds scanned events, so a page may be empty after authorization filtering.
- Delivery is at least once: applying a page and then losing its checkpoint can repeat it.
- `reset: true` means refresh your snapshot. It is set when obtaining a head cursor or when the
  caller's effective read scopes change. Persisting a cursor is not a grant of historical access.
- Invalid or incompatible cursors return HTTP 400 `InvalidEventCursor`. Obtain a new head cursor,
  then reload current data before continuing. Events are retained indefinitely in this release;
  there is no background pruning or silently truncated replay window.

Feed reads evaluate current grants and event rows in one repeatable-read transaction. Live subjects
use their current ownership scope; deleted subjects use captured ancestry checked against current
grants. This retains deletion history for authorized ancestor readers without keeping dead foreign
keys. Scope internals and numeric positions are never exposed. Responses are private and uncached.

When first attaching a cache, obtain the head cursor **before** the final snapshot refresh. This
closes the gap between an initial page load and starting the consumer. Each mounted authenticated
shell polls every two seconds while visible and online, drains catch-up pages immediately, and
retries failures with backoff capped at 30 seconds. It retains its acknowledged cursor across
network interruptions; remounting starts from the head and resets the cache. Identity changes abort
old requests. Permission changes clear cached records before fetching again.

## Boundaries

The journal also serves as the transactional outbox; delivery systems should reference its events
rather than copy their payloads into another log. A worker can persist its own cursor after processing
or durable handoff. This checkpoint does not include worker leases, delivery subscriptions, scheduled
jobs, or controller execution. Replaying history must not blindly repeat external side effects:
those need stable operation keys and durable receipts.

Browser updates currently invalidate cached queries and refetch through governed APIs. They do not
replicate full records, provide offline writes, or establish a TanStack DB replica. Polling provides
cross-client freshness on the current host; an SSE adapter can reuse the journal later. Authentication
still runs on each request through the configured identity provider.

The portable event definition belongs to `@company/runtime`; composition, authorization, persistence,
and migrations belong to the application. `EventJournal.layer` is an Effect v4 service using the
application Database. Replacing it must preserve atomic persistence; a remote publish call cannot
substitute for the journal. Continual integration is optional future consumption, not a dependency.
