# Documentation

Start with the repository [`README`](../README.md) for the product, quick start, and included lead
conversion operation. These documents provide the next level of detail without duplicating the
executable contracts in code, tests, manifests, or the Developer Center.

- [Architecture](architecture.md) — package responsibilities, dependency direction, and authority
- [Building a module](modules.md) — define records, add custom actions and UI, and read/write data
- [Client data](data.md) — model queries, route preloading, mutations, and live cache updates
- [Durable events](events.md) — transactional facts, authorized replay, and browser updates
- [Modeling](modeling.md) — the business-model vocabulary and relationship choices
- [Database workflow](runbooks/database.md) — migrations, local resets, and production deployment
- [Deployment and identity](runbooks/deployment.md) — the current build target, authentication, and optional hosting integration

For a first code review, follow the [application reading path](../apps/company-os/README.md#follow-a-feature-through-the-code):
Engineering Issue first, then Sales Lead conversion, then the shared runtime and storage machinery.

Package and application READMEs explain how to work in one part of the repository. Repository-wide
contributor constraints live in [`AGENTS.md`](../AGENTS.md). Agent skills contain evolving product
and ownership rationale; they are not a second reference for current routes, exports, or commands.
