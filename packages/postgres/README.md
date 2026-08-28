# @company/postgres

The reusable server-only PostgreSQL adapter for a portable `@company/runtime` model. It compiles the
model into a deterministic Drizzle schema and implements the standard object and Link repository
contracts used by application backends.

```ts
import { Model } from "@company/model"
import { makePostgresSchema } from "@company/postgres"

export const Storage = makePostgresSchema(Model)
```

`makePostgresSchema` is a pure compiler, not an Effect service. The application binds the generated
tables to its typed database, repository registry, governed services, and transport handlers.

## Responsibilities

The adapter preserves mechanical storage behavior shared across models, including ownership
hierarchy, interface membership, Links, aliases, filtering, pagination, optimistic writes, and
transactional invariants. PostgreSQL supplies authoritative record timestamps and successor entity
tags in the same statements that enforce write preconditions.

The compiler maps portable persisted shape into native columns, defaults, nullability, foreign keys,
declared uniqueness rules, indexes, and structural checks. Governed object services remain
responsible for portable schema validation and canonicalization before writes reach a repository.

The central application owns its model, migrations, credentials, custom persistence queries,
authorization, Effect service identities, and deployment. Migration SQL remains explicit committed
history beside that backend; follow the [database workflow](../../docs/runbooks/database.md).

## Boundaries

This package may depend on `@company/runtime` and server-side PostgreSQL libraries. It must not
depend on `@company/model`, an application, or `@company/ui`, and it does not create a second copy of
application policy.

Read the [architecture guide](../../docs/architecture.md) for the complete persistence and service
composition boundary.

## Develop

From the repository root:

```sh
pnpm --filter @company/postgres test
pnpm --filter @company/postgres typecheck
```
