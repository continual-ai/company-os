# @company/postgres

The reusable server-only PostgreSQL adapter for a portable `@company/runtime` model. It compiles the
model into typed SQL identifiers and deterministic PostgreSQL DDL and implements the standard object and Link repository
contracts used by application backends.

```ts
import { Model } from "company-os/model"
import { makePostgresSchema } from "@company/postgres"

export const Storage = makePostgresSchema(Model)
```

`makePostgresSchema` is a pure compiler, not an Effect service. The application binds the generated
tables to its Effect SQL client, repository registry, governed services, and transport handlers.

## Responsibilities

The adapter preserves mechanical storage behavior shared across models, including ownership
hierarchy, interface membership, Links, aliases, filtering, pagination, optimistic writes, and
transactional invariants. PostgreSQL supplies authoritative record timestamps and successor entity
tags in the same statements that enforce write preconditions.

The compiler maps portable persisted shape into native columns, defaults, nullability, foreign keys,
declared uniqueness rules, indexes, and structural checks. A Link declared as `subsetOf` another Link
gets a composite foreign key: removing membership clears its primary selection. Inline references
restrict target deletion. Governed object services remain
responsible for portable schema validation and canonicalization before writes reach a repository.

`defineTable` gives infrastructure tables one server-owned declaration for physical column types,
defaults, nullability, descriptions, and constraints. That declaration supplies both `Table.ddl` and
typed column descriptors; domain declarations are derived from the portable model. Custom indexes,
functions, and triggers remain ordinary application-owned SQL.

`Table` contains a physical name, `ddl`, and typed `columns`; it is a native Effect SQL fragment, with no
query or execution methods. Custom queries use the same `sql` tagged templates as the standard
repositories. `insertValues` and `assignments` encode model storage values while preserving SQL
expressions; `pgTypes` decodes native PostgreSQL values into portable timestamps, dates, and bytes.

`projection` preserves camel-case field aliases and `SelectionRow` follows their annotations.
Neither it nor `sqlValue<T>` validates SQL results or infers join nullability. Custom queries may use
plain SQL and decode their results against the model's declared output; see the
[pipeline summary](../../apps/company-os/src/modules/sales/deal/server/pipeline-summary.ts). These
helpers support model storage, not a second query builder or an additional authored business model.

The central application owns its model, migrations, credentials, custom persistence queries,
authorization, Effect service identities, and deployment. Migration SQL remains explicit committed
history beside that backend; follow the [database workflow](../../docs/runbooks/database.md).

## Boundaries

This package may depend on `@company/runtime` and server-side PostgreSQL libraries. It must not
depend on `company-os/model`, an application, or `@company/ui`, and it does not create a second copy of
application policy.

Read the [architecture guide](../../docs/architecture.md) for the complete persistence and service
composition boundary.

## Develop

From the repository root:

```sh
pnpm turbo run test typecheck --filter=@company/postgres
```
