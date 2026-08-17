# Company OS architecture

> Draft architectural context, not a target specification. Start from current code and first
> principles, recommend better boundaries when warranted, and keep only accepted durable guidance.

## Ownership map

| Owner              | Paths                                            | Responsibility                                                                                |
| ------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Company            | `packages/acme/*`, `apps/*`                      | Business nouns, rules, UI, migrations, services, adapters, and composition                    |
| Reusable framework | `packages/continual/*`                           | Universal definitions, runtime machinery, browser-safe clients, generic UI, Studio, and CLI   |
| Hosted platform    | Outside this repository                          | Optional identity, agents, connections, managed infrastructure, delivery, controls, and audit |

`@continual/*` must never import `@acme/*`. Browser apps use `@acme/client` and `@acme/ui`; they do
not import server runtime, API internals, Studio, or CLI. The API is the private composition root.

## Target request path

Evolve the modular monolith toward this explicit flow:

```text
app or agent
  -> public backend contract
  -> transport binding
  -> business service or tool
  -> repository and capability ports
  -> Postgres and external providers
```

Transport validates and binds a request. A service or tool owns one business intent, including
policy, transaction, domain events, approvals, and coordination. Repositories own persistence
queries and row mapping. Provider adapters own vendor SDKs. Assemble the graph once in
`apps/api/src/composition-root.ts` and pass dependencies explicitly.

Do not create all layers mechanically. A small slice may remain direct until policy, persistence,
or external effects justify a boundary.

## Source and contract

Keep the company model explicit and closed-world: only definitions composed by
`packages/acme/model/src/project.ts` belong to it. Do not discover modules or capabilities from
filenames.

Use explicit imports inside a package. Do not create internal barrel files, wildcard exports, or
re-export chains. A package may keep one deliberate public facade at its top-level `src/index.ts`;
that facade uses explicit named re-exports and is the target of the package's `exports["."]` entry.
Register each facade explicitly in the Company OS Oxlint rule. For a single public implementation,
point the package export directly at that file.

Author a concept once and derive its serializable description, client types, documentation, and
eventual protocol projections. The runtime contract stays compatible with ordinary Fetch so the
same backend can run locally or behind different hosts.

Treat MCP, REST, and OpenAPI as projections of one backend contract. None should become a parallel
business implementation. Add a projection when a real consumer requires it.

## Data, policy, and effects

- Begin with one Postgres database and one transaction boundary.
- Keep schema and migrations in company source. Do not let a hosted control plane become the only
  place the business schema exists.
- Evaluate domain authorization in the backend using verified actor context. Hosted identity may
  establish the actor but does not decide company policy by itself.
- Commit domain facts and an outbox record atomically when reliable asynchronous delivery matters.
  Deliver at least once and make consumers idempotent.
- Perform external effects after commit through durable, retryable work. Assign each synchronized
  fact one authority and compose webhook, command, repair, and scheduled paths through the same
  idempotent operation.
- Keep caches, search indexes, analytics, and work queues derivative and repairable.

## Apps and agents

Website, portal, workspace, Studio, and agent conversations are interfaces over the same backend.
Keep consumer-specific queries and presentation with the consumer, while business rules and writes
remain behind governed capabilities.

Agents receive authorized tools and documents, never raw database credentials or private runtime
objects. A human-facing work queue may coordinate review and approval, but it should refer to
business records rather than duplicate them.

## Evolution rules

- Build the next abstraction from an ordinary end-to-end business slice, not from the most complex
  future case.
- Keep the modular monolith until a measured scaling, isolation, or deployment need justifies a
  service boundary.
- Introduce a capability port only when it isolates vendor types, is smaller and more stable than
  the provider SDK, and supports a meaningful alternate implementation.
- Preserve local operation when adding hosted services. Bind direct-provider, in-memory, or local
  adapters at the same composition root.
- Treat handbook-derived architecture as direction. Update this reference only after a design is
  accepted, and do not describe a proposal as current code.
