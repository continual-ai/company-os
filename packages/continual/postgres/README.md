# @continual/postgres

Reusable PostgreSQL storage for a Company OS semantic model.

This server-only adapter compiles a portable `@continual/runtime` model into deterministic Drizzle
tables and provides the standard PostgreSQL object repository implementation. It owns mechanical
storage behavior shared by company backends: object hierarchy, interface membership, links,
aliases, filtering, pagination, optimistic writes, and transactional invariants.

PostgreSQL is authoritative for record timestamps: inserts use column defaults and updates set
`updated_at = now()` in the same statement that checks the current entity tag. The same write
generates the successor tag with PostgreSQL's UUID generator. Audit actor IDs arrive from the
governed service; no trigger or session identity is hidden beneath the repository query.

The compiler maps persisted shape into native columns, defaults, nullability, foreign keys,
declared `uniqueBy` invariants, standard indexes, and structural checks. Scalar arrays use native
PostgreSQL arrays; structured values use JSONB. The adapter deliberately does not duplicate
portable property rules such as string lengths, numeric ranges, select membership, or formats as
SQL constraints; governed object services validate and canonicalize those rules for every caller
before a repository write.

```ts
import { AcmeModel } from "@acme/api"
import { makePostgresSchema } from "@continual/postgres"

export const AcmeStorage = makePostgresSchema(AcmeModel)
```

The package does not own a company's model, migrations, credentials, Effect service identities,
authorization, or deployment. The company backend binds its generated storage to a typed Drizzle
`Database` service and exposes one repository capability per object. Migration SQL remains
explicit, source-owned history beside that backend.

`makePostgresSchema` is a pure compiler, not an Effect service. Runtime capabilities remain ordinary
Effect services and Layers at the application composition root: PostgreSQL client, typed database,
object repositories, governed services, then transport handlers.
