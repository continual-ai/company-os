# Company OS architecture

> Draft architectural context, not a target specification. Start from current code and first
> principles, recommend better boundaries when warranted, and keep only accepted durable guidance.

## Ownership map

| Owner              | Paths                       | Responsibility                                                                                |
| ------------------ | --------------------------- | --------------------------------------------------------------------------------------------- |
| Company            | `packages/acme/*`, `apps/*` | Business nouns, rules, UI, migrations, services, adapters, and composition                    |
| Reusable framework | `packages/continual/*`      | Universal definitions, projections, execution, and browser-safe client machinery              |
| Hosted platform    | Outside this repository     | Optional identity, agents, connections, managed infrastructure, delivery, controls, and audit |

`@continual/*` must never import `@acme/*`. Browser apps use `@acme/ui`, `@acme/api`, and
browser-safe runtime client entrypoints; they never import server-only Company OS modules. The
server boundary of `apps/company-os` is the private composition root; its internal Console and
external transports are interfaces over the same governed backend.

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
`apps/company-os/src/server/composition-root.server.ts` and pass dependencies explicitly.

Do not create all layers mechanically. A small slice may remain direct until policy, persistence,
or external effects justify a boundary.

## Source and API

Keep the semantic API explicit and closed-world: only definitions composed by
`packages/acme/api/src/index.ts` belong to it. Do not discover modules or capabilities from
filenames. `defineApi` creates the authoritative portable contract. The API contains business
semantics, not an inventory of repository apps, and OpenAPI is one protocol projection rather than
its source.

Object IDs, collection names, and object-scoped action verbs form one flat API-wide namespace.
Modules organize source, documentation, and default Console navigation; they do not appear in client
paths or prohibit cross-module references and actions. Validate global identity, action subjects,
and method collisions when composing the API. Typed clients use the globally unique collection
as their one useful grouping boundary, such as `client.companies.list()` and
`client.leads.qualify()`. Construct that ordinary client object directly from the closed semantic
definition; no generated source artifact or module-level namespace is required.

Create, get, list, update, delete, and batch-get are standard object operations rather than authored
actions. Lists use bounded page sizes and opaque continuation tokens, returning an empty next-page
token at the end; batch-get is bounded and order-preserving. Mutation routes expose one idempotency
key convention. Custom object actions use
their declared verb in client methods and project to an AIP-style route such as
`POST /api/v1/leads/{leadId}:qualify`. The subject ID comes from the route; it is not repeated in the
JSON payload. Keep these rules in the reusable HTTP projection rather than writing transport details
into semantic definitions.

The current Effect v4 projection lives at `@continual/runtime/effect/http`. It creates one `HttpApi`
from the closed semantic API and provides the Fetch-compatible Scalar handler mounted by
`apps/company-os`. The private composition root uses Effect's `OpenApi.fromApi` directly rather
than wrapping it. The documented operations are a contract preview until the Company OS
composition root supplies real handlers.

Use explicit imports inside a package. Do not create internal barrel files, wildcard exports, or
re-export chains. A package may keep one deliberate public facade at its top-level `src/index.ts`;
that facade uses explicit named re-exports and is the target of the package's `exports["."]` entry.
Register each facade explicitly in the Company OS Oxlint rule. For a single public implementation,
point the package export directly at that file.

Author a concept once and derive its serializable description, client types, documentation, and
eventual protocol projections. The runtime contract stays compatible with ordinary Fetch so the
same backend can run locally or behind different hosts.

Company source uses the portable schema and field vocabulary exported by `@continual/runtime`;
it does not import Effect Schema. Server code projects those definitions through
`@continual/runtime/effect`. This keeps Effect v4 available for validation and execution without
making it the durable Company API format.

Field behavior is part of that portable contract. Records have total output shapes and fields are
non-nullable by default. Create-required input, explicit nullability, kind-level zero values,
defaults, output-only behavior, and immutability mechanically drive distinct response, create, and
update schemas. Transport projections preserve those semantics with native annotations such as
OpenAPI `readOnly`; they do not reconstruct behavior from naming conventions. Write-only secrets
belong to operation or action inputs rather than durable object fields.

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

The marketing site, client portal, internal Console, and agent conversations are interfaces over
the Company OS backend. The backend and Console share one full-stack TanStack Start deployment;
that deployment choice does not weaken the contract or server-only boundaries. Keep
consumer-specific queries and presentation with the consumer, while business rules and writes
remain behind governed capabilities. A generic model inspector may return as a development tool
when real operating needs earn it; it is not a separate product surface by default.

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
