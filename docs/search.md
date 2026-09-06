# Search

Command/Ctrl-K searches records, navigates collections, and opens the standard creation forms.
It works throughout the app, including Settings and Developer Center. Results use the same object
identity and hover preview as tables and relationships. Searchable records need not appear in the sidebar.

## Declare searchable fields

Opt in on the object itself; no marker interface or separate registry is needed:

```ts
export const Contact = defineObject({
  // Existing identity, properties, parent, and display configuration…
  search: { fields: ["name", "email", "jobTitle", "phone"] },
})
```

Only declared text fields enter the index. Display-title matches rank above other fields. Objects
without `search` are excluded. The model explorer marks indexed fields, and the public model
metadata includes the declaration. System identity and authorization objects are not indexed by default.

Search matches all supplied word prefixes, ignoring case. Names, email domains, URLs, and punctuation
use the same PostgreSQL tokenization on writes and reads. This is lexical discovery, without typo
tolerance, semantic embeddings, or a query language. Structured field filters remain on object `list`
queries; search does not replace collection filtering or exhaustive pagination.

## Client and API

```ts
const results = useModelQuery(
  data.records.search({
    query: "ada analytical",
    objectTypes: ["contact"],
    limit: 20,
  })
)
```

Router loaders and imperative clients can pass the same options to `queryClient.ensureQueryData`.
The palette debounces input, cancels obsolete requests, and never hydrates results one at a time.
Results participate in the existing model cache: mutations and journal events invalidate searches
for affected object types; identity and permission changes reset the cache.

The shared Effect HTTP contract exposes:

```http
POST /api/v1/records:search
Content-Type: application/json

{"query":"ada analytical","objectTypes":["contact"],"limit":20}
```

`objectTypes` is optional. Responses contain `hits` and `hasMore`. Each hit has `id`, `objectType`,
`title`, `subtitle`, `image`, and `status`. These are display summaries, not partial canonical records;
never merge them into the record cache. Use the object's `get` or `batchGet` for full records.
The default limit is 20, the maximum is 50, and `hasMore` indicates that narrowing the query would help.
There are no hidden totals or snippets from unreadable records. See `/developer/api` for the generated
OpenAPI contract. Search is currently an application HTTP capability, not an object-specific MCP tool.

## Transactional index

`record_search` is one disposable PostgreSQL projection with a GIN full-text index. Search joins
this table to the live object directory and filters by current read permissions **before** ranking,
limiting, or computing `hasMore`. Authorization is not copied into index rows. A grant or membership
change takes effect without rebuilding documents.

At the outer transaction boundary, `Database` gathers subjects from the transaction's staged events,
locks the affected live records, and updates their search documents once per object type. It then
flushes the journal and commits. Standard writes, custom facts, the search index, and events commit or
roll back together. Search reflects committed operations; code inside an unfinished Action should use
the object's `get` or ordinary SQL to read its own uncommitted changes. Deletion cascades remove index
rows. Bootstrap seed writers update the same projection without fabricating runtime events.

Custom SQL must preserve ordinary locking, revision, and integrity rules and append a declared fact
covering affected records inside `Database.transaction`, as required by [the event contract](events.md).
SQL that bypasses that contract also bypasses search maintenance. The index is rebuilt from current
business tables, never from historical event payloads.

`pnpm --filter company-os db:migrate` compares the installed search definition with the source model
and rebuilds only when indexed fields, display configuration, or the projection version change.
The rebuild locks source tables, replaces the index, and records the definition in one transaction.
Readers keep seeing the old committed index while writers wait. Plan a maintenance window for large
rebuilds; this implementation intentionally does not add an online indexing worker.

To repair an index after an out-of-band import:

```sh
pnpm --filter company-os db:migrate --rebuild-search
```

The code is concentrated in `src/records.ts` (public contract),
`src/server/model/search-records.ts` (authorized query),
`src/server/database/search-index.ts` (projection and rebuild), and
`src/ui/application/command-palette.tsx` (interaction).
