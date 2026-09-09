# Search

Command/Ctrl-K searches records across objects, navigates collections, and opens creation forms.
Results use the same identity and hover preview as tables and relationships.

## Declare searchable fields

```ts
export const Contact = defineObject({
  // identity, properties, display…
  search: { fields: ["name", "email", "jobTitle", "phone"] },
})
```

Only declared text fields enter the index; objects without `search` are excluded, including the
Access objects. Display-title matches rank first. Matching requires every supplied word prefix,
ignoring case, with the same PostgreSQL tokenization on writes and reads. This is lexical discovery,
not typo tolerance, embeddings, or a query language; structured filters stay on object `list`
queries.

## Client and API

`data.records.search({ query, objectTypes, limit })` on the application client returns query
options on the shared cache; mutations and journal events invalidate searches for affected object
types. The HTTP contract is `POST /api/v1/records:search`. Hits carry `id`, `objectType`, `title`,
`subtitle`, `image`, and `status` as display summaries, never partial records, so do not merge them
into the record cache. The default limit is 20 and the maximum 50; `hasMore` means narrow the query.

## Transactional index

`record_search` is a disposable projection with a GIN index. Queries join it to the live object
directory and filter by current read permissions before ranking or limiting, so a grant change takes
effect without rebuilding documents. At the outer transaction boundary, `Database` updates the
documents for staged subjects, then flushes the journal and commits; standard writes, custom facts,
search, and events succeed or roll back together. Search reflects committed state only. Custom SQL
that bypasses the event contract also bypasses index maintenance.

`pnpm --filter company-os db:migrate` compares the installed search definition with the model and
rebuilds only when indexed fields, display configuration, or the projection version change. The
rebuild locks source tables and swaps the index in one transaction; readers keep the old index
while writers wait. After an out-of-band import, `db:migrate --rebuild-search` repairs it.

The pieces are `runtime/contract/record-search.ts` (contract), `runtime/server/record-search.ts`
(authorized query), `runtime/server/storage/search-index.ts` (projection and rebuild), and
`app/ui/application/command-palette.tsx` (interaction).
