# Building a module

A module is a cohesive business capability under `apps/company-os/src/modules/<name>`. It owns its
definitions, custom operations, presentation, and fixtures, and it is testable without the shell.
Standard CRUD, storage, HTTP, MCP tools, and default pages derive from the model; write custom code
only for behavior or invariants the model cannot express. Create one directory per capability, not
per object.

## Directory shape

```text
apps/company-os/src/modules/sales/
  model/
    index.ts                    defineModule; exports the definitions other modules may reference
    lead.ts                     one object, its operation contracts, and its events
    interfaces/party.ts         a polymorphic role several objects implement
    links/contact-companies.ts  an association without identity
  server/
    index.ts                    defineModuleServer binds custom operations to declared methods
    convert-lead.ts             one transactional business action
    operations-database.test.ts PostgreSQL tests for the module's rules
  ui/
    index.ts                    defineModuleUi composes each object's presentation
    lead/config.ts              typed extensions for one object
    lead/convert-button.tsx     an ordinary React component
    lead/views.ts               saved collection views
  seeds/
    index.ts                    fixture builders the shell invokes explicitly
```

Only `model/` is required. Notes has no `server/`; Support Engineering has no `seeds/`. Do not add
empty folders or forwarding files. Each `index.ts` is a registered entrypoint and may re-export by
name; everything else imports concrete files with `#/` paths and explicit extensions.

A module imports itself, other modules' `model/`, and `runtime/`. It never imports `app/`, the
composition roots, or another module's `server/`, `ui/`, or `seeds/`. When two otherwise independent
modules need a relationship, put the Link, any bridging Object, and the Action that joins them in a
small bridge module that depends on both, as `support-engineering` does for Support and Engineering.

## Model

Use `defineObject`, `defineLink`, `defineInterface`, `defineEvent`, and `defineModule` from
`#/runtime/model/index.ts`. Keep an object's properties, custom operation contracts, `search`
fields, and `display` metadata together in its file. Objects default to the kernel `Root` as parent;
set `parent` only for durable ownership and authorization ancestry. The module's dependencies are
derived from the types its definitions reference, so nothing declares them by hand.

```ts
export const SalesModule = defineModule({
  id: "sales",
  name: "Sales",
  interfaces: [Party],
  events: [LeadConverted],
  links: [ContactCompanies, ContactPrimaryCompany, DealCompanies],
  objects: [Activity, Company, Contact, Lead, Deal, LineItem],
})
```

A module that implements an interface owned elsewhere lists it in `implements`; composition resolves
interface references to the installed concrete types. Read [modeling](modeling.md) before choosing
between a parent, a reference property, a Link, and an association Object.

`modules/sales/model/lead.ts` shows a custom Action contract and its event; `modules/engineering`
shows a standard object graph with no custom operations at all.

## Custom server operations

Write named `Effect.fn` functions and bind them to the declared method in `server/index.ts`:

```ts
export const SalesServer = defineModuleServer(SalesModule, {
  lead: { convert: convertLead },
  deal: { pipelineSummary },
})
```

Operations use the kernel services from `#/runtime/server/index.ts`. `Authorization.require`
establishes the caller's authority for the operation and the records it touches. `Records.writer(O)`
and `Links.writer(O)` validate, attribute, and record events but do not authorize, so require first.
`Records.get(O)` reads. `RecordIdentifierResolver` turns a canonical id or alias into a record id.
`Database.sql` with `ModelContext.table(O)` and the statement helpers in
`#/runtime/server/storage/index.ts` supports custom SQL without a second schema.

An Action opens one `Database.transaction`; standard writes inside it join that transaction, and a
failure anywhere rolls back everything. `EventJournal.append(Event, { subject, data })` records a
declared business fact in the same transaction. Custom SQL that writes must preserve revision and
integrity rules and append a declared event covering the affected records; raw SQL is not
intercepted. Queries are read-only and constrain rows to the caller's scopes before aggregating.
Expected domain failures use the model's `ApiError` contract so HTTP and MCP need no per-module
error handling. `modules/sales/server/convert-lead.ts` is the executable example.

Add a `Context.Service` only for a cohesive capability or a real substitution boundary, never to
forward existing methods. Pass its layer as the third argument of `defineModuleServer`.

## UI

`defineModuleUi` in `ui/index.ts` checks object, property, and action names against the module's
definitions. Each object's extensions live in `ui/<object>/config.ts` as an `ObjectUi<typeof O>`:
`navigation`, `fieldEditors`, `actions` with their placements, `collection` (`views`,
`toolbarComponent`, `pageComponent`), and `record` (`properties`, `relationships`, `title`,
`summaryComponent`, `overviewComponent`, `additionalTabs`, `pageComponent`). Saved views come from
`defineCollectionView`. Import these from `#/runtime/ui/module.ts` and primitives from
`#/runtime/ui/components/*.tsx`.

Components read and write through `useObjectClient(O)`, which returns the same query and mutation
options the shell uses, on the same cache, with server-driven invalidation. Do not add private HTTP
clients or object-specific branches to shared routes. Use additions for light customization and an
ordinary React page with `pageComponent` for a distinct workflow; the escalation page in
`modules/support-engineering/ui` is one. [Model UI](model-ui.md) describes what the default pages
already provide.

## Seeds

`seeds/index.ts` exports explicitly invoked fixture builders such as `seedSalesDemo`, written with
the same `Records` writers as production code. A seed may compose another module's `seeds/index.ts`
and return the ids a scenario needs. The shell owns scenarios in `app/seeds/`, selects volume, and
links records across modules with `linkSeedRecords`. Nothing seeds on import or on startup.

## Register the module

1. `app.model.ts`: add the module to `defineModel({ modules })`. This changes the storage
   projection; follow the [database workflow](runbooks/database.md).
2. `app.server.ts`: add its `defineModuleServer` result when it has custom operations.
3. `app.ui.ts`: add its `defineModuleUi` result.
4. `app.config.ts`: add its id to `enabledModules` when the UI, API, and MCP should expose it. The
   list must be closed under dependencies; startup names any missing module.

Missing dependencies, duplicate ids, invalid layout mappings, and conflicting tabs fail during
composition, not at request time.

## Test a module alone

Compose only the module and the modules it depends on, then use `testFoundation` from
`#/runtime/testing/foundation.ts`:

```ts
const model = defineModel({
  name: "Engineering test",
  modules: [AccessModule, AssetsModule, NotesModule, EngineeringModule],
})
const fixture = await testFoundation(model)
// Effect.provide(fixture.layer) supplies Database, Records, Links, Authorization,
// EventJournal, and initialized system records against an isolated PostgreSQL database.
await fixture.dispose()
```

Name PostgreSQL tests `*-database.test.ts`; they run in the `database` Vitest project and need a
role with `CREATEDB`. Pure rules and rendering use the `unit` project and no database. Test
authorization with a real invocation (`systemInvocation`, `anonymousInvocation`) rather than a
mocked service. `modules/engineering/server/model-database.test.ts` verifies a module persists with
only its declared dependencies; `modules/sales/server/operations-database.test.ts` exercises a
custom Action end to end.
