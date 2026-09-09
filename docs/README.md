# Documentation

Start with the repository [`README`](../README.md) for the product, quick start, and how modules are
enabled. These documents add the next level of detail without duplicating the executable contracts
in code, tests, and the Developer Center.

- [Architecture](architecture.md) — the three directories, the four composition roots, and where
  authority lives
- [Building a module](modules.md) — directory shape, custom operations, UI, seeds, registration,
  and isolated tests
- [Modeling](modeling.md) — vocabulary and relationship choices
- [Model UI](model-ui.md) — what the standard record and collection pages provide and how modules
  extend them
- [Client data](data.md) — queries, mutations, preloading, and live cache updates
- [Durable events](events.md) — transactional facts, authorized replay, and the feed contract
- [Search](search.md) — searchable fields, the API, and the transactional index
- [Database workflow](runbooks/database.md) — migrations, tests, local resets, and production
- [Deployment and identity](runbooks/deployment.md) — build, configuration, identity providers,
  and publishing

Repository-wide constraints live in [`AGENTS.md`](../AGENTS.md). Agent skills under `.agents/skills`
carry evolving product and ownership rationale; they are not a second reference for current routes,
exports, or commands.
