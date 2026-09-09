# Durable events

The kernel keeps an append-only journal in PostgreSQL beside the business tables. Business tables
stay authoritative; the journal records committed facts and supplies replay to browsers,
integrations, and agents. No broker or separate worker is involved.

## Follow a write

1. An Action authorizes, then writes through `Records.writer` and `Links.writer`. Object writers
   stage `created`, `updated`, and `deleted` facts; link writers stage actual `linked` and
   `unlinked` changes, including primary replacement and deletion cascades.
2. `Database.transaction` opens one PostgreSQL transaction with one event buffer. A nested call
   joins it: no savepoint, one buffer. An uncaught inner failure fails the whole write; catching an
   inner failure keeps the writes made before it, so recover-and-continue flows must roll back
   explicitly.
3. Immediately before commit, the transaction updates the [search index](search.md) for staged
   subjects, allocates journal positions under a single locked counter row, inserts the events, and
   calls `pg_notify`. PostgreSQL delivers the wakeup after commit; the payload carries no records.
4. The committed object types drive HTTP cache invalidation; other browsers learn the facts through
   the authorized feed.

Events and business writes commit or fail together. Position allocation serializes only the short
final flush, so a large transaction holds that lock longer. Do not perform network effects after
positions are allocated.

## Add a business fact

Declare the event beside its subject and list it in the module's `events`:

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

Standard Object and Link events derive from the model. Custom facts validate against the composed
model's event definitions; nothing is registered by hand. Inside the Action's transaction:

```ts
export const convertLead = Effect.fn("sales.convertLead")(function* (input) {
  const events = yield* EventJournal
  // Authorize and write inside database.transaction, then record the fact:
  yield* events.append(LeadConverted, {
    subject: lead.id,
    data: { company: companyId, contact: contact.id },
  })
})
```

`append` validates the payload, copies it, and derives related subjects from semantic reference
and file fields, including nested arrays, maps, and unions. Optional `related` ids add further
visibility constraints. A reader receives a custom fact only when every subject is readable, so use
reference fields rather than untyped strings for identifiers. Appending outside a transaction fails.
Custom SQL writes must append a declared fact covering their records in the same transaction.

Events carry stable ids, transaction ids, type and version, subjects, actor, occurrence time, and
recording time. The actor comes from the invocation; callers cannot submit one or write journal
records over HTTP. Standard create and update events contain the full record with its etag;
deletions contain `{ id, etag }` with the tombstone revision. Standard snapshots have the visibility
of reading the object itself.

## Consume the feed

`listEvents` on the application client reads `GET /api/v1/events`; `subscribeEvents` opens the
SSE stream at `/api/v1/events:stream`.

- Omit `cursor` to replay retained history; `cursor: "now"` starts at the committed head. `type`
  selects one exact event type. A cursor is bound to its caller and filter.
- Persist `nextCursor` after applying a page, including an empty one. `hasMore` means request the
  next page immediately. Page size bounds scanned events, so authorized pages can be empty.
- Delivery is at least once. `reset: true` means reload cached data before continuing; it is set
  when obtaining a head cursor and when the caller's effective read scopes change.
- An invalid or incompatible cursor returns HTTP 400 `InvalidEventCursor`; obtain a new head cursor
  and reload. Events are retained indefinitely in this release.

Feed reads evaluate current grants and event rows in one repeatable-read transaction. Live subjects
use their current ownership scope; deleted subjects use captured ancestry checked against current
grants. Persisting a cursor is not a grant of historical access.

The shell obtains its head cursor before the server renders its records, then streams from that
cursor, advancing the checkpoint only after the cache applies a page. Streams end after 60 seconds
so reconnecting repeats authentication; access is rechecked on every page including idle
checkpoints. Reconnection starts with a durable pull, then reopens SSE, backing off to 30 seconds.
`EventNotifications.layer` uses one shared PostgreSQL `LISTEN` connection; `layerPolling` supplies
the same feed without it for transaction-pooling endpoints. Notifications are hints, never a second
log.

## Boundaries

The journal is also the transactional outbox. An integration keeps its own durable cursor and
idempotency keys and references journal events rather than copying payloads into another log.
Replaying history must not repeat external side effects. Retained snapshots include values later
edited or deleted and are authorized by current read grants, not historical ones; a deployment with
retention or erasure requirements applies its policy to the journal as well as the business tables.
Do not put credentials in business fields. Replacing `EventJournal.layer` must preserve atomic
persistence; a remote publish call cannot substitute for the journal.
