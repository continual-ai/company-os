# @continual/postgres

Reusable PostgreSQL storage for a Company OS semantic model.

This server-only adapter compiles a portable `@continual/runtime` model into deterministic Drizzle
tables and provides the standard PostgreSQL object repository implementation. It owns mechanical
storage behavior shared by company backends: object hierarchy, interface membership, links,
aliases, filtering, pagination, optimistic writes, and transactional invariants.

The compiler maps persisted shape into native columns, defaults, nullability, foreign keys,
uniqueness, indexes, and structural checks. It deliberately does not duplicate portable property
rules such as string lengths, numeric ranges, select membership, or formats as SQL constraints;
governed object services validate those rules for every caller before a repository write.

```ts
import { AcmeModel } from "@acme/api"
import { makePostgresSchema } from "@continual/postgres"

export const AcmeStorage = makePostgresSchema(AcmeModel, {
  objects: {
    // Deliberate company-specific physical overrides belong here.
  },
})
```

The package does not own a company's model, schema overrides, migrations, credentials, Effect
service identities, authorization, or deployment. The company backend binds its generated storage
to a typed Drizzle `Database` service and exposes one repository capability per object. Migration
SQL remains explicit, source-owned history beside that backend.

`makePostgresSchema` is a pure compiler, not an Effect service. Runtime capabilities remain ordinary
Effect services and Layers at the application composition root: PostgreSQL client, typed database,
object repositories, governed services, then transport handlers.
