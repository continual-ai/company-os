# Client data

One model, one server authority, one client cache. `app/app-client.ts` derives the semantic client
from `EnabledModel` and exposes it as `data`; every object gets TanStack Query options for its
Queries and mutation options for its Actions.

```tsx
const contacts = useQuery(data.contact.list({ pageSize: 50 }))
const updateContact = useMutation(data.contact.update())
await updateContact.mutateAsync({
  id: contact.id,
  etag: contact.etag,
  name: "Morgan Chen",
})
```

Router loaders pass the same options to `context.queryClient.ensureQueryData`. Query keys derive
from object, operation, and arguments, so options can be constructed inline. SSR uses one cache per
request and hydrates the browser. Module components use `useObjectClient(O)` from
`#/runtime/ui/module.ts`, which returns the same options on the same cache.

## Ownership

| Code                                     | Responsibility                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `app/app-client.ts`                      | Assemble the private Effect HTTP client; export `data` and the feed API |
| `runtime/client/model-query-client.ts`   | Derive typed query and mutation options from the model                  |
| `runtime/client/data-client.ts`          | QueryClient lifetime, identity isolation, and invalidation              |
| `runtime/client/model-cache.ts`          | Apply canonical records, ordered revisions, tombstones, and resets      |
| `app/ui/application/use-model-events.ts` | Subscribe to the event feed, apply pages, checkpoint, and reconnect     |

Queries are fresh for 30 seconds and unused entries are collected after five minutes. Focus returns
revalidate stale queries. Writes are never retried automatically; retrying a non-idempotent Action
needs its own durable key. Errors keep the decoded `ApiError`, so forms render violations by path.

## Follow an edit

1. A form captures its draft and opening etag. Background reads never replace the draft.
2. The server decodes input, authorizes, checks the etag, and writes in one transaction.
3. The response carries the affected object types in `x-model-changes`.
4. The browser cancels pre-commit reads and patches the confirmed record wherever it appears.
5. Affected lists, relationship membership, counts, and custom reports revalidate on the server.
6. Other browsers receive authorized journal snapshots over SSE and reconcile the same way.

Etags are decimal strings ordered by revision; feature code passes them through unchanged and only
the cache reconciler compares them. A stale response cannot roll back a newer cached record. Only
standard create and update responses patch records; a custom Action's output is a receipt, and its
declared events supply the snapshots. Custom Queries are invalidated after any business write
because components do not declare their SQL dependencies.

Permission changes reset cached data instead of leaving previously visible records on screen.
Identity changes clear the cache. The server enforces access independently on every request; the
cache never evaluates permissions locally. There is no client SQL layer, normalized replica, or
offline write queue. [Durable events](events.md) covers the feed contract.
