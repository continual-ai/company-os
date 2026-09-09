# Building a module

A module owns a cohesive business capability: definitions, custom operations, specialized UI,
and tests. Keep standard object behavior derived from the model. Create a package per domain,
not per object or function. App-specific modules can use the same structure inside the app.

## Structure and composition

```text
modules/sales/
  package.json
  src/
    model/
      index.ts
      lead.ts
      links/contact-companies.ts
    server/
      index.ts
      convert-lead.ts
      operations-database.test.ts
    ui/
      index.ts
      lead/config.ts
      lead/convert-button.tsx
    seeds/
      index.ts
      demo.ts
      performance.ts
      assets/
```

Package exports map each public surface to its folder's entrypoint:

```json
{
  "./model": "./src/model/index.ts",
  "./server": "./src/server/index.ts",
  "./ui": "./src/ui/index.ts",
  "./seeds": "./src/seeds/index.ts"
}
```

Expose only the surfaces the module needs. `/model` exports portable definitions; `/server` exports
implementations registered with `defineModuleServer`; `/ui` exports `defineModuleUi` registrations;
`/seeds` exports explicitly invoked fixture builders. Seeds are server-only even when a particular
helper only constructs values. Stylesheets belong in `ui/` and may have an explicit CSS export.

A small surface can live entirely in `index.ts`; do not create forwarding files or empty folders
for symmetry. Larger surfaces organize their implementation files within the folder. Tests live
beside the behavior they exercise. Public entrypoints may expose explicit named exports, but
internal code imports definitions directly instead of following re-export chains. Use public model
imports for dependencies on another domain. Private imports use `#/` with actual source extensions.
Oxlint enforces the source folders, browser/server import boundaries, and public-only re-exports.

The application composes three ordinary TypeScript graphs:

| Entry point         | Responsibility                                          |
| ------------------- | ------------------------------------------------------- |
| `src/app.model.ts`  | Install definitions into one complete model             |
| `src/app.server.ts` | Register custom module implementations and their layers |
| `src/app.ui.ts`     | Compose module presentation registrations               |

Declare dependencies in `package.json`, install with pnpm, and import contributions at the relevant
roots. There is no generated code, dynamic discovery, runtime unloading, or second plugin container.
Model-only modules need no server or UI registration. Missing dependencies and conflicting
registrations fail during composition. Removing a disposable template module means removing its
contributions and regenerating the app's initial database baseline.

## Model definitions

Use `defineObject`, `defineLink`, and `defineModule` from `@company/runtime/model`. Keep each object's
properties, operations, display metadata, and relationship ownership together. Export definitions
other modules need through the module's model entrypoint.

References express directional state. Links express associations; use `subsetOf` for a primary
selection within a larger association. Use an Object when the relationship has attributes,
lifecycle, history, or permissions. `parent` describes ownership and authorization ancestry.

A standalone module knows an interface contract, not all its future implementors. Composing the
model resolves interface references to the installed concrete object types. Runtime validation
checks those same memberships.

See [Engineering Issue](../modules/engineering/src/model/issue.ts) for a standard object and
[Sales Lead](../modules/sales/src/model/lead.ts) for custom action and event contracts.

## Custom server behavior

Write named `Effect.fn` operations. Use `Records`, `Links`, `Database`, `Authorization`,
`EventJournal`, and `ModelContext` from `#/runtime/server/index.ts`. Services supplied by providers
may be layerless; constructed services expose `.layer`. Add a new service only for a cohesive
capability or useful substitution boundary, not to forward existing methods.

[SalesServer](../modules/sales/src/server/index.ts) binds custom operations to their declared model methods.
The runtime supplies standard CRUD. The app composes these contributions and shared infrastructure;
it does not need a Sales-specific adapter. Current invocation and transaction event buffers are
never captured when binding module operations.

Use `Records.writer(Object)` for validated writes with event recording and
`Links.writer(Object)` for validated relationship changes; neither checks a capability, so call
`Authorization.require` first. Custom SQL uses `Database.sql` and `ModelContext.table(Object)`, not
a second hand-maintained schema. Actions own authorization and open one `Database.transaction`;
standard writes inside it join that transaction rather than opening their own. SQL queries must filter authorized rows before aggregation;
keep currencies separate and use PostgreSQL numeric arithmetic. Expected domain failures use the
model's portable error contract so HTTP and MCP need no domain-specific error switches.

## UI

Use `@company/runtime/ui/module` for module authoring helpers and `@company/runtime/ui/*` for primitives. `defineModuleUi` checks object,
field, and action names against the module's definitions. `composeModelUi` validates relationships
and tab conflicts against the complete model. The application's `ModelUiProvider` supplies the
semantic client and shared presentation configuration.

Module components call `useObjectClient(Object)`. These query/mutation options use the app's
QueryClient, request keys, and server-driven invalidation. Do not add private HTTP clients or
object-specific branches to shared routes. Extensions support field editors, record summaries,
additional tabs, collection controls, and complete page replacements. Notes demonstrates a custom
Markdown editor and timeline reused across overview, relationships, and standalone collections.

## Tests and PostgreSQL

```sh
pnpm --filter @company/sales test
pnpm --filter @company/marketing test
pnpm --filter @company/engineering test
```

Modules are testable without the app. Compose only their declared model dependencies, initialize
the model's SQL projection, and provide `foundationLayer` when testing governed behavior. Supply
test layers only for actual external providers. Pure rules and rendering need no database.

`@company/runtime/testing` creates isolated databases and scoped clones from caller-supplied DDL or
an initializer. Tests require a PostgreSQL role with `CREATEDB`; `DATABASE_URL` selects the connection
(default `postgresql://localhost:5432/postgres`). The configured database is never truncated.
`@company/runtime/testing/foundation` supplies `testFoundation(model)`: real authorization, writers,
events, initialized system records, and isolated scoped databases. Dispose the template after the suite.
The Sales test uses the real Access services and event journal. App tests cover transport assembly,
identity adapters, and cross-module workflows.

## Migrations and seeds

The composed application owns one migration sequence. Module definitions feed the shared SQL
projection; the app's baseline includes precisely the installed model. This template regenerates
its initial baseline instead of preserving disposable migration history. Customized deployments
with durable data own their subsequent explicit SQL migrations.

Module seed helpers provide domain data through the same model and storage APIs. The app selects
the scenario and volume; fixtures never import the app. Keep test initialization explicit rather
than seeding automatically when a module is imported.

## Static application composition

`app.model.ts` exports the one installed `Model`; `company-os/model` exposes that same portable
value to optional interfaces. It contains Access and Assets by default. Register business modules
in source, with their custom implementations in `app.server.ts` and presentation in `app.ui.ts`.
There are no environment-selected module profiles. Package dependencies make imports available;
module `requires` declarations check what the composed model actually installs.

Reusable domains belong in `modules/<domain>` packages. Bespoke domains may stay under the app's
`src/modules/<domain>` with the same surface folders. Extract a package when another app or fork
needs a stable boundary; do not require publication to npm. All these sources remain editable.

A cross-domain integration is a module of its own when either side remains useful independently.
The app-owned Support–Engineering bridge owns its link, escalation receipt, custom Action, and
React page. Support alone does not import Engineering. See [dogfooding](dogfooding.md).

`src/examples` contains explicit test compositions and demo scenarios. Production roots do not
import the full fixture model. Module `/seeds` exports own fixture implementations and assets;
small cross-domain scenarios join their returned IDs. No seed runs on import or normal startup.
