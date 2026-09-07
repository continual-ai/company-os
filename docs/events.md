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
4. Immediately before the outer commit, the database updates the [search index](search.md) for staged
   subjects, then allocates journal positions and inserts
   the events. A single counter row stays locked until commit. This makes committed positions
   safe to consume in order even when concurrent transactions finish out of order.
5. The flush calls `pg_notify` in the same transaction. PostgreSQL delivers this wakeup only after
   commit; its payload contains no records or credentials. The event subjects determine HTTP cache invalidation. There is no separate write-set
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
persistence. Replay uses a stable envelope with a JSON payload, so changing an Object or retiring a
custom fact cannot make committed history unreadable. Standard Object and Link event types derive
from the model automatically; they need no registration. Consumers decode the types and versions
they understand. See the executable Lead conversion for the complete example.

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
occurrence time, and recording time. Standard create/update events use version 1 and contain the full canonical record, including its
ordered etag. Deletions contain `{ id, etag }`, where the tombstone advances the last record
revision. Version 1 invalidation facts remain readable. Standard snapshots have the visibility of
reading that object: reference IDs do not confer access to referenced records. Custom business facts
continue to require read access to every derived subject.
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
shell resumes the head captured before the server's child loaders read their records, then consumes `GET /api/v1/events:stream?cursor=...`. The generated
Effect HTTP client decodes typed SSE pages, whose `id` equals `nextCursor`. The client advances its
checkpoint only after applying the page, rather than assuming receipt means successful processing.
A client-only mount obtains a head cursor and resets its data before continuing. The server-rendered
path already has a checkpoint and avoids clearing hydrated records on startup.
It reconnects with that applied cursor; the query parameter is the resume contract (not an automatic
browser EventSource acknowledgement).

`EventNotifications.layer` uses one shared PostgreSQL LISTEN connection per application runtime.
Subscribers register before reading the journal, coalesce wakeups, and drain committed pages.
Notifications are hints, not a second log. Every stream also catches up after 15 seconds of inactivity,
covering missed wakeups and rechecking access. Connections close after 60 seconds so reconnecting
repeats authentication. Revocation latency is therefore bounded by the page check/connection renewal,
not by an indefinitely trusted session. A slow subscriber retains at most one wakeup and resumes
from its journal cursor.

Hidden/offline tabs disconnect. Reconnection starts with a durable pull and then opens SSE; failures
back off to 30 seconds. Hosts that buffer SSE still recover through pull requests and periodic stream
checkpoints. `EventNotifications.layerPolling` supplies the same journal feed without LISTEN, and
`makeApplicationLayer` accepts either layer. PostgreSQL LISTEN requires a session connection rather
than a transaction-pooling endpoint. Disconnecting the notification service cannot lose commits.

Full snapshots are retained indefinitely in this release, including values later edited or deleted.
Current read grants authorize that retained history; this is not field-level redaction or immutable
historical ACL enforcement. Do not place credentials in business object fields. A deployment with
retention/erasure requirements must explicitly apply its policy to both business tables and the
journal. Historical payloads retain their original shape. The browser validates snapshots against
the current Object schema before applying them; incompatible snapshots trigger normal query
revalidation without entering the cache. Custom consumers must handle their own supported versions.
Changing current definitions does not rewrite stored facts; incompatible snapshots trigger a current read.

## Boundaries

The journal also serves as the transactional outbox; delivery systems should reference its events
rather than copy their payloads into another log. A worker can persist its own cursor after processing
or durable handoff. This checkpoint does not include worker leases, delivery subscriptions, scheduled
jobs, or controller execution. Replaying history must not blindly repeat external side effects:
those need stable operation keys and durable receipts.

Browser updates apply snapshots to existing cache appearances and refetch affected collections and
reports. They do not replicate an entire database or infer server authorization locally. The journal
is also suitable for integration consumers with their own durable checkpoints and idempotency keys.

The portable event definition belongs to `@company/runtime`; composition, authorization, persistence,
and migrations belong to the application. `EventJournal.layer` is an Effect v4 service using the
application Database. Replacing it must preserve atomic persistence; a remote publish call cannot
substitute for the journal. Continual integration is optional future consumption, not a dependency.
