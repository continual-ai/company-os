# Documentation

Start with the repository [`README`](../README.md) for the product, quick start, and how modules are
enabled. These documents add the next level of detail without duplicating the executable contracts in
code, tests, manifests, or the Developer Center.

- [Architecture](architecture.md) — directory responsibilities, dependency direction, and authority
- [Building a module](modules.md) — define records, add custom actions and UI, and read/write data
- [Record workspaces](record-workspaces.md) — default navigation, forms, relationships, and UI composition
- [Client data](data.md) — model queries, route preloading, mutations, and live cache updates
- [Durable events](events.md) — transactional facts, authorized replay, and browser updates
- [Modeling](modeling.md) — the business-model vocabulary and relationship choices
- [Database workflow](runbooks/database.md) — migrations, local resets, and production deployment
- [Deployment and identity](runbooks/deployment.md) — the build target, authentication, and optional hosting

Repository-wide constraints live in [`AGENTS.md`](../AGENTS.md). Agent skills under `.agents/skills`
carry evolving product and ownership rationale; they are not a second reference for current routes,
exports, or commands.
