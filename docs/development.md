# Development

[Back to the README](../README.md)

Build against the model; write the migration when the feature is ready.

| Command                      | Purpose                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `pnpm db:reset`              | Rebuild the disposable local database from the model and refresh `schema.sql`         |
| `pnpm db:migration <name>`   | Create the next SQL migration draft with structural diff hints                        |
| `pnpm db:migrate`            | Apply completed migrations to a database with migration history, or an empty database |
| `pnpm dev`                   | Run the apps                                                                          |
| `pnpm check`                 | Lint, typecheck, generated schema/model checks, formatting, and dead code             |
| `pnpm test`                  | Test application behavior against the current model                                   |
| `pnpm test:migrations`       | Verify migration replay matches the model before delivery                             |
| `pnpm build`                 | Build the apps                                                                        |
| `pnpm format`                | Format the repository                                                                 |
| `pnpm ui:add <component>`    | Add a shadcn primitive to `packages/ui`                                               |
| `pnpm ui:remove <component>` | Remove an unused primitive                                                            |

**While building:** edit the model and application, run `pnpm db:reset` after storage changes,
and use the app. Reset discards the configured local schema's data, restores system records and
search, and leaves all migration files untouched. It refuses remote hosts and PostgreSQL system
databases. Run `pnpm db:seed --scenario demo` when you want fictional records.

**When ready:** run `pnpm db:migration add_owner`. It replays existing migrations and the current
model in separate scratch databases, then creates a numbered `.sql` file in
`apps/company-os/src/app/server/database/migrations/`. The draft contains structural differences
as comments and a failing placeholder. Have your agent replace the placeholder with reviewed SQL;
renames, backfills, and other business transformations need your intent. A supplied name creates a
draft even without structural differences, for data-only changes. Without a name, an unchanged
schema creates no file. Finish an existing draft before asking for another.

Run `pnpm test:migrations` to verify the upgrade, and add retained-data tests for transformations.
Ordinary application tests use the current model, so they work before the migration is written.
CI runs both suites. Commit the model, `schema.sql`, migration, and relevant tests together.
Migration files run in numbered order; never rewrite applied files. Documentation-only changes
in generated SQL comments do not require migrations.

**When applying:** point `DATABASE_URL` at an empty database or one with migration history and run
`pnpm db:migrate`. A development database created by `db:reset` has no migration history and is
intentionally refused; use the isolated migration tests to verify delivery instead of upgrading
that disposable database.

Migration drafting and database tests need a PostgreSQL role with `CREATEDB`. Scratch databases
are removed afterward. Tests default to `postgresql://localhost:5432/postgres`; commands use the
application's configured connection. After changing the database environment,
`pnpm turbo run test --force` bypasses cached test results. For inspecting a retained database,
`pnpm --filter company-os db:dump` writes an ignored `schema.actual.sql` using `pg_dump` (the
server's major version or newer).

## Application structure

Business code lives in `apps/company-os/src/modules`; the kernel is in `src/runtime` and the shell
in `src/app`. `app.model.ts` composes every module. Administrators explore and enable modules in
Settings > Platform > Modules. Activation is stored in the database and controls UI, HTTP, and MCP,
leaving disabled modules' data intact. Platform is always enabled. Enabling a
module also enables its dependencies; turning one off asks you to confirm any dependent modules. Newly added optional modules
start disabled on existing installations; an initial setup enables all installed modules.
Change product identity and the entry experience in `src/app/customization`.

[AGENTS.md](../AGENTS.md) holds repository conventions. The skills point to working source examples;
code, tests, and generated contracts define the implementation. `apps/client-portal` is an optional
satellite over the central app's API; delete it if unnecessary or copy it for another interface.

### Actions and Queries

Objects generate `get`, `list`, `batchGet`, `create`, `update`, `delete`, and `batchDelete`.
Disable standard writes with `actions: { delete: false }`; disabling delete also disables batch
deletion. Custom operations are standalone `defineAction` or `defineQuery` definitions, registered
once in their owning module's `actions` or `queries` array.

```ts
export const EscalateTicket = defineAction({
  id: "escalate",
  object: Ticket,
  name: "Escalate to engineering",
  description: "Creates an engineering issue for an open support ticket.",
  input: { id: schema.id(Ticket) },
  output: { issue: schema.id(Issue) },
})
```

`object: Ticket` requires an explicit, non-nullable `input.id: schema.id(Ticket)`.
`collection: Ticket` attaches to the collection and adds no parameters. Omit both for a global
operation. The module owns activation and implementation; the attachment controls discovery and
placement. An extension module can attach an operation to another module's Object.

| Attachment        | HTTP                                 | MCP               | Client                           |
| ----------------- | ------------------------------------ | ----------------- | -------------------------------- |
| Ticket record     | `POST /api/v1/tickets/{id}:escalate` | `ticket.escalate` | `client.ticket.escalate({ id })` |
| Ticket collection | `POST /api/v1/tickets:summary`       | `ticket.summary`  | `client.ticket.summary({})`      |
| Global            | `POST /api/v1/:reconcile`            | `reconcile`       | `client.reconcile({})`           |

Custom Queries also use POST with a structured body. Record IDs go in the HTTP path; MCP and the
semantic client retain them in the explicit input. `schema.id` accepts canonical IDs or qualified
aliases on input and emits canonical IDs on output. Module names do not appear in public operation
names. Composition rejects duplicate names and collisions with standard methods or Link traversals.

`defineModuleServer` binds methods in the same shape as the client: `{ ticket: { escalate } }`,
or `{ reconcile }` for a global operation. Actions run in a transaction. Queries run read-only and
cannot call writers or Actions, or join a write transaction. Within an Action, read through `Records`
in the same transaction. Business operations still own admission checks, validation, invariants,
and external-effect failure handling; read-only execution does not sandbox external services.

The browser-safe model owns definitions. `runtime/contract/operations.ts` resolves complete schemas
once per composed model; HTTP/OpenAPI and MCP project that catalog. UI uses the active model and the
shared semantic client/cache. Record and collection Actions get schema-driven forms unless replaced
by a custom control. `useOperationClient(EscalateTicket)` provides typed TanStack options for custom
controls; `OperationAction` can place a global Action on a module page. Queries provide typed cache
options for views, without inventing a visualization from their output schema.

### Relationships

Declare every relationship once with `defineLink`; both directions use the same stored edge.
Scalar properties contain values. `schema.id` is for Action and Query inputs or outputs,
not stored relationships.

```ts
const DealOwner = defineLink({
  id: "dealOwner",
  name: "Deal owner",
  from: Deal,
  to: User,
  forward: { key: "owner", label: "Owner", max: 1 },
  reverse: { key: "ownedDeals", label: "Owned deals" },
})
```

`min` defaults to zero; omitted `max` means unbounded. Bounds are enforced in both directions.
A single link renders as one identity and a single-select editor; a collection renders a preview
and a multi-select editor. Changing cardinality does not change the wire shape.

Get, list, and batch-get return scalar properties alongside `objectType` and `links`:

```json
{
  "id": "deal_…",
  "objectType": "deal",
  "name": "Expansion",
  "links": {
    "owner": { "ids": ["user_…"], "totalSize": 1 },
    "companies": { "ids": ["company_…"], "totalSize": 1 }
  }
}
```

Each link includes at most three IDs and an exact `totalSize`. Use the traversal's paginated
`list` operation for the complete collection. Hydrate previews with `records.batchGet({ ids })`
(HTTP `POST /api/v1/records:batchGet`, MCP `records.batchGet`). It deduplicates input, preserves
input order, and returns `missingIds` for missing or inactive records. Hydration returns the same
canonical record shape without recursively expanding linked records.

Create accepts `links: { owner: [userId] }`. Update accepts
`links: { owner: { replace: [userId] }, companies: { add: [companyId], remove: [oldId] } }`.
`replace` cannot be combined with `add` or `remove`. Linking a second target to a `max: 1`
relationship fails; use explicit replacement. Subset links require membership in their base
link; changing a selection does not silently add or remove base membership. Multi-link writes
validate the final transaction state and commit together.

Ownership is a link traversal with `onDelete: "cascade"`; its opposite direction must have
`max: 1`. Deleting the source then deletes its linked targets. The default only removes edges,
and fails if surviving records would lose a required relationship. Unlinking never deletes
records. `outputOnly: true` reserves a link for trusted Actions and removes public mutation
operations in both directions. Use an Object when the relationship itself needs properties,
Actions, or a lifecycle.

### Page spacing

Compose layouts with `PageHeader`, `PageToolbar`, `PageContent`, and `PageSectionHeader` from
`@company/ui/page`. Headers and content share a 16px gutter; toolbar rows are at least 48px and
grow when controls wrap. Content sections are separated by 24px. `PageHeader.navigation` owns the
bottom divider alignment; use `TabsList variant="header"` there without tab spacing overrides.
The containing page or panel owns padding once, so custom tab content must not add another outer
gutter. Tables remain edge-to-edge. Sidebar rows use 8px outer plus 8px inner padding, aligning their
content at 16px; their compact row rhythm is independent of page toolbars. Cards and controls own
their internal spacing. Use `p-page-gutter` directly only when a layout cannot use these components.

### Browser preferences

Use `useLocalPreference` from `@company/ui/local-preferences` for browser-local presentation
preferences. The app shell supplies `LocalPreferencesProvider` with an app and user namespace.
Each preference has a stable key, default value, and validator; change the key when its stored shape
changes incompatibly. Reads are SSR-safe, invalid values use the default, and blocked storage falls
back to the current session. Resize controls keep live interaction state and save only on completion,
keyboard adjustment, or explicit reset. Viewport constraints must not overwrite the saved preference.
Keep credentials and authoritative business data out of this store.
