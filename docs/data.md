# Data access

One model, one server authority, one client cache. PostgreSQL owns records and business rules.
The application projects its model into HTTP/OpenAPI/MCP and TanStack Query options.

```tsx
const contacts = useQuery(data.contact.list({ pageSize: 50 }))
const updateContact = useMutation(data.contact.update())
await updateContact.mutateAsync({
  id: contact.id,
  etag: contact.etag,
  name: "Morgan Chen",
})
```

Pass the same options to `context.queryClient.ensureQueryData` in a Router loader. Query keys derive
from object, operation, and arguments; constructing options inline needs no memoization. The Router
integration uses an isolated server cache for each request and hydrates the browser cache. The server
Fetch adapter forwards the current request's credentials into the same governed HTTP handlers.

## Ownership

| Code                    | Responsibility                                                                |
| ----------------------- | ----------------------------------------------------------------------------- |
| `app-client.ts`         | Assemble the private Effect HTTP client and public model options              |
| `model-query-client.ts` | Derive typed query/mutation options from the model                            |
| `data-client.ts`        | QueryClient lifetime, identity isolation, and invalidation                    |
| `model-cache.ts`        | Apply canonical records, ordered revisions, tombstones, and permission resets |
| `use-model-events.ts`   | Subscribe, apply, checkpoint, and reconnect                                   |
| `ui/model/*`            | Standard collection/detail/form behavior and light UI extensions              |

The cache has a 30-second freshness window and a five-minute unused-entry lifetime. Focus returns
revalidate stale queries. Writes are never automatically retried; retrying a non-idempotent business
operation requires its own durable key. Query and mutation errors retain the decoded API failure.

## Follow an edit

1. A form captures its draft and opening etag. Background reads cannot replace that draft.
2. The server decodes input, authorizes the operation, checks the etag, and writes in a transaction.
3. The transaction records events and reports actual affected object types in `x-model-changes`.
4. The browser cancels pre-commit reads and applies the confirmed record to existing appearances.
5. Affected lists, relationship membership, counts, and reports revalidate through the server.
6. Other browsers receive authorized journal snapshots through SSE and use the same reconciliation.

The default is immediate feedback with pending controls and confirmed writes. It does not invent
optimistic results for arbitrary Actions. Records have decimal-string ordered etags; feature code
passes them unchanged. Only the central reconciler compares revisions. A stale mutation response
cannot roll back a newer cached record. Deletions remove existing appearances and reload membership.
Custom queries are conservatively invalidated after business writes because their SQL dependencies
are not declared by React components.

Permission changes reset data, rather than leaving previously authorized records visible during
refetch. Identity changes clear the browser cache and invalidate pending applications of old results.
The server independently enforces current access for every operation. Read [events](events.md) for
history visibility and the bounded authentication-renewal window of streaming connections.

## Shared UX

Collections support shareable filters and views, direct title search, sorting, pagination, inline
editing, selection, and batch deletion. Command/Ctrl-K jumps between collections. Default detail
pages expose both relationship directions; concrete reference fields navigate directly to their
record. Pickers can create related records without losing the outer form's draft. Forms use one
schema decoder and one API-error boundary, preserve edits on conflict, and confirm draft dismissal.

Records render before reference labels or advisory permissions. Related-record pages already contain
full records; the browser does not hydrate them again. Independent reference labels use bounded
queries that omit inaccessible results. This avoids failing an otherwise readable record because
one reference is unavailable.

There is no client SQL layer, normalized replica, offline write queue, or parallel Atom cache.
Integration workers and future agents use the same governed actions and durable journal; provider
execution, checkpoints, idempotency, and receipts must be implemented for each real integration.
