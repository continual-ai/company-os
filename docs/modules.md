# Building a module

A module is ordinary source you own. Begin with a real operation: its records, deterministic rules,
human decisions, failure behavior, and evidence of success. Standard screens provide the starting
point; domain components express the workflow.

## Three independent entrypoints

```text
src/modules/sales/
  model.ts                        # Composes portable definitions
  server.ts                       # Binds custom server operations
  ui.ts                           # Composes object UI configurations
  lead/
    model.ts                      # Properties and Query/Action contracts
    server/
      convert.ts                  # Implements lead.convert
    ui/
      config.ts                   # Registers navigation, actions, tabs, and views
      convert-button.tsx          # Implements a React component
      conversion-tab.tsx
      views.ts
  deal/
    model.ts
    server/pipeline-summary.ts
    ui/config.ts
    ui/pipeline-summary.tsx
  links/contact-companies.ts
  interfaces/party.ts
```

Folders identify the business owner, then the concern. Object directories and filenames use
singular kebab-case. Each object has a `model.ts`; add `server/` and `ui/` only when needed. Custom
Queries and Actions live under their object's `server/`, named after the operation. Contracts remain
in that object's model. A transition such as Lead conversion belongs to Lead even when it writes
other objects. Tests sit beside implementations; PostgreSQL tests use `-database.test.ts`.

Links and interfaces have one authoritative definition under the owning module's `links/` and
`interfaces/` directories. Cross-module Links belong to the module introducing the association;
it explicitly imports its dependencies. References remain inline in an object's model. An association
with identity, attributes, or its own lifecycle gets an ordinary object directory.

`ui/config.ts` contains typed registration objects; named `.tsx` files contain React components.
Module-level `model.ts`, `server.ts`, and `ui.ts` compose contributions and stay small. Shared server
capabilities can live in the module's `server/` directory when multiple objects need them. Avoid
empty directories, mandatory service/repository pairs, internal barrels, and runtime file discovery.

Installation is explicit and happens once per entrypoint:

| Contribution           | Application composition root    |
| ---------------------- | ------------------------------- |
| Model                  | `src/model.ts`                  |
| Custom server behavior | `src/server/module-services.ts` |
| Custom UI              | `src/app-ui.ts`                 |

Once installed, changes within a module do not require editing the application layer, implementation
registry, sidebar, or standard routes. The model check verifies conventional definition locations.
The model's recursive import check rejects UI/server dependencies; TanStack rejects server directories
and module-level `server.ts` entrypoints in the browser graph. React components may render on the
server. Browser-only code is a separate boundary, not a synonym for UI.

## Add an object

Define it with `defineObject` and `schema` from `@company/runtime`, then include it in the module's
`objects`. The Engineering Issue is the smallest complete example. A root-owned Campaign could be:

```ts
import { defineObject, schema } from "@company/runtime"
import { User } from "#modules/access/user/model"
import { Root } from "#root"

export const Campaign = defineObject({
  id: "campaign",
  collection: "campaigns",
  name: "Campaign",
  pluralName: "Campaigns",
  parent: Root,
  properties: {
    name: schema.string({ minLength: 1, maxLength: 200 }),
    owner: schema.reference(User, { nullable: true }),
    attachments: schema.array(schema.file({ maxBytes: 25_000_000 }), {
      default: [],
    }),
  },
  display: { title: "name", icon: "megaphone" },
})
```

Put that definition in `modules/marketing/campaign/model.ts`. Compose it in
`modules/marketing/model.ts`:

```ts
import { defineModule } from "@company/runtime"
import { Campaign } from "./campaign/model"

export const MarketingModule = defineModule({
  id: "marketing",
  name: "Marketing",
  interfaces: [],
  links: [],
  objects: [Campaign],
})
```

Include the module in `src/model.ts`, then run `pnpm --filter company-os db:generate`, review the
migration, and run `pnpm dev`. Migrations remain application-owned. Define intended roles and scopes;
installing an object does not grant everyone permission to use it.

Storage projection, standard governed services, HTTP/OpenAPI/MCP, the typed client, default forms,
list/detail routes, and incoming-reference navigation derive from the model. The default routes
are `/objects/campaign` and `/objects/campaign/{id}`. No per-object route file is needed.

Use `parent` for ownership and authorization hierarchy. Use references for directional state,
Links for bidirectional relationships without independent identity, and association Objects for
relationships with their own attributes, lifecycle, or policy.

## Add a Query or Action

Queries read authorized state; Actions change it. Both declare input, output, scope, and expected
errors beside the object. Standard operations need no binding. Custom operations are named
`Effect.fn` functions; only override standard operations when business rules require it.

Sales is the executable example:

```ts
export const SalesServer = defineModuleServer(
  SalesModule,
  Effect.succeed({
    lead: { convert: convertLead },
    deal: { pipelineSummary },
  })
)
```

Read [convert.ts](../apps/company-os/src/modules/sales/lead/server/convert.ts) for a transactional
Action and [pipeline-summary.ts](../apps/company-os/src/modules/sales/deal/server/pipeline-summary.ts) for
an authorized SQL aggregate. The binding checks required custom methods against the model and captures
infrastructure dependencies. Caller identity and transaction-change tracking remain invocation-local.
The application supplies Database, Authorization, repositories, and other infrastructure once.

| Responsibility                                         | Location                                    |
| ------------------------------------------------------ | ------------------------------------------- |
| Portable input, output, metadata, expected failures    | Object definition                           |
| Decode untrusted requests                              | Shared HTTP/MCP invocation boundary         |
| Permissions, business decisions, transaction ownership | Operation function                          |
| Small custom SQL                                       | Operation file, optionally a private helper |
| Shared or substantial persistence behavior             | Focused repository                          |
| Resource acquisition and replaceable dependencies      | Effect services and Layers                  |
| Presentation and advisory permission checks            | Module UI                                   |

A repository is a persistence responsibility, not a mandatory class. `Context.Service` is Effect's
injected dependency mechanism, not a requirement to create another business layer. Plain calculations
remain ordinary TypeScript functions. Use services for a concrete capability, lifecycle, shared
implementation, or useful substitute. Access and Assets illustrate services that also support identity
provisioning and blob delivery outside standard model methods.

Authorize before trusted writes. `Database.transaction` and model writers preserve validation,
concurrency, asset integrity, and change tracking. Low-level SQL writes must preserve those invariants
and report changed types inside the transaction. Keep irreversible external calls outside database
transactions; use durable integration intent when work spans systems.

The pipeline Query requires `deal.pipelineSummary` at the root. Its SQL includes only deals readable
by the current caller, sums exact decimals, and groups by currency. Granting report permission alone
returns no records. Do not fetch every deal into JavaScript to calculate a total.

```ts
const summary = data.deal.pipelineSummary({}) // TanStack Query options
const conversion = data.lead.convert() // TanStack mutation options
```

Generated OpenAPI describes these concrete endpoints and their model-defined result schemas:

```http
POST /api/v1/deals:pipelineSummary
POST /api/v1/leads/{id}:convert
GET  /api/v1/contacts/{id}/companies
POST /api/v1/contacts/{id}/primaryCompany:link
```

Custom Queries use POST custom methods so structured requests fit in a body; they remain read-only,
share query caching, and carry MCP read-only annotations. Standard list/get retain GET. Relationship
mutation bodies contain `{ "target": "company_..." }`; path parameters identify the source.
Relationship lists return complete records with an `objectType` discriminator and normal pagination.
They do not require a second client hydration request.

Test pure rules directly. Test SQL, locking, transactions, and authorization with the real PostgreSQL
harness. Supply test services for provider effects. The [sales integration test](../apps/company-os/src/modules/sales/server/sales-operations-database.test.ts)
checks scoped totals, caller isolation, conversion retries and races, outer rollback, change tracking, primary affiliation,
and independence between commercial participation and authorization.

## Extend the standard UI

Three levels cover ordinary customization: keep the default page, extend its named regions, or
write a custom page. UI configurations reference real React components. There is one configuration
per object, explicitly composed by its owning module; duplicate registrations fail rather than merge.

An object's `ui/config.ts` uses `satisfies` to check properties, Action IDs, and component props:

```ts
import type { Model } from "company-os/model"
import type { ObjectUi } from "@/ui/model/module-ui"
import { ConvertLeadAction } from "./convert-button"
import { LeadConversion } from "./conversion-tab"

export const leadUi = {
  actions: {
    convert: { component: ConvertLeadAction, placements: ["row", "record"] },
  },
  record: {
    additionalTabs: [
      { id: "conversion", label: "Conversion", component: LeadConversion },
    ],
  },
} satisfies ObjectUi<typeof Model.objects.lead>
```

The module's `ui.ts` composes these objects with `defineModuleUi(SalesModule, { lead: leadUi })`.
Page assembly resolves the configuration once and passes explicit props to standard React components.
Form-dialog assembly does the same for field editors. Leaf components and action renderers do not
look up another registry or declare mutation invalidation dependencies.

| Extension                     | Behavior                                                            |
| ----------------------------- | ------------------------------------------------------------------- |
| `navigation`                  | Configures the object's destination, visibility, ordering, and icon |
| `actions`                     | Adds components for model Actions at explicit row/record placements |
| `collection.views`            | Defines the available saved views                                   |
| `collection.toolbarComponent` | Adds controls alongside the standard collection controls            |
| `collection.pageComponent`    | Replaces the entire collection page                                 |
| `record.additionalTabs`       | Appends named tabs in declaration order; collisions fail            |
| `record.overviewComponent`    | Replaces the default properties overview                            |
| `record.pageComponent`        | Replaces the entire record page                                     |
| `fieldEditors`                | Replaces editors for named properties inside the standard form      |

Record components receive `RecordUiProps<typeof Model.objects.lead>`: the typed record and advisory
`can` helper. The shared Action renderer checks permission before rendering. Server authorization
remains authoritative. A toolbar receives its object, effective search (including saved-view filters
and sort), and advisory `can`. This is collection context, not an implicit global state store.

Field editors receive `FieldEditorProps`: input value, change/blur callbacks, and accessibility
state. These are TanStack Form input values; the model decoder runs at submission. Engineering's
[description editor](../apps/company-os/src/modules/engineering/issue/ui/description-field.tsx)
demonstrates the pattern. Labels, error rendering, submission, and file integrity remain shared.

Replacement pages receive the object and route state and own their loading and layout.
Default route preloaders skip replaced pages; preload custom requests in an ordinary route loader. They can
compose `ObjectCollection` or `ObjectRecordPage` with explicit props; these components do not look
up page replacements, so there is no recursive dispatch. Full page replacements own the page's
extensions rather than automatically inheriting hidden configuration. Standard form dialogs still
use the object's registered editors.

For a workflow spanning several objects, write ordinary React under the owning module and register
an ordinary TanStack route. Keep the route file thin. Use the semantic client, shared form components,
and governed operations. Add shell navigation explicitly when needed; object configuration does not
create arbitrary workflow URLs. Edit shared shell code when changing the shell itself. Add a new
extension point only when a concrete repeated need justifies it.

## Read and write data

The application exports `data` from `src/app-client.ts`. Model Queries produce native TanStack Query
options; Actions produce mutation options. React and Router use the same request, cache, and types.
There is no feature-specific fetching hook or second relational query language.

```tsx
import { useQuery, useMutation } from "@tanstack/react-query"
import { data } from "@/app-client"

const backlog = data.issue.list({
  filter: { field: "status", operator: "eq", value: "backlog" },
  sort: [{ field: "createdAt", direction: "desc" }],
  pageSize: 50,
})

// In a Router loader:
// await context.queryClient.ensureQueryData(backlog)

export function BacklogPreview() {
  const issues = useQuery(backlog)
  const createIssue = useMutation(data.issue.create())
  if (issues.isPending) return <p>Loading backlog…</p>
  if (issues.isError) return <p role="alert">Could not load the backlog.</p>
  return (
    <>
      <button
        disabled={createIssue.isPending}
        onClick={() =>
          createIssue.mutate({ title: "Investigate customer feedback" })
        }
      >
        Add issue
      </button>
      {createIssue.isError && (
        <p role="alert">The issue could not be created.</p>
      )}
      <ul>
        {issues.data.items.map((issue) => (
          <li key={issue.id}>{issue.title}</li>
        ))}
      </ul>
    </>
  )
}
```

This preview reads one page; use `ObjectCollection` or handle `nextPageToken` for a complete collection.
Options can be constructed inline: request values determine cache identity, not object identity.
Standard pages preload on the server and hydrate the browser's cache. Each server request owns an
isolated QueryClient. Background refreshes keep the previous result visible; `isPending` represents
initial loading and `isFetching` includes background work.

`list` uses GET with filters, sorting, and cursor pagination. Structured filter and sort values are
JSON query parameters. `batchGet` hydrates known identifiers; custom methods use colon suffixes.
There is no duplicate generic search API. Large filters remain subject to URL limits: independently
paginated chunks cannot preserve global ordering. Reference label hydration uses bounded authorized
lists, so an unavailable reference never prevents rendering the main record.

Actions such as `useMutation(data.lead.convert())` use the same model. Server transactions report
actual changed types through `x-model-changes`; the shared reconciler updates returned record
appearances and refreshes collection membership, counts, and custom reports. Feature code never
lists mutation write sets or manually reloads after a successful write. Use `mutateAsync` when an
existing dialog owns pending/error behavior. Effects stay inside the transport and server assembly.

The authorized SSE feed applies full standard record snapshots and deletion tombstones through the
same reconciler. Older responses cannot overwrite newer revisions. Keep interaction state and
unsaved drafts locally; do not copy query results into component state. Standard edit dialogs retain
the opening etag and draft, reject conflicting edits, and ask before discarding unsaved changes.
See [Data access](data.md) for cache, concurrency, and reconnect behavior.

The resulting HTTP contract uses ordinary resources and colon custom methods:

```text
GET    /api/v1/issues                         list (filter, sort, pageSize, pageToken)
GET    /api/v1/issues/{id}                    get
POST   /api/v1/issues                         create
PATCH  /api/v1/issues/{id}                    update
DELETE /api/v1/issues/{id}                    delete
POST   /api/v1/issues:batchGet                hydrate known IDs
POST   /api/v1/issues:batchDelete             delete a batch
POST   /api/v1/leads/{id}:convert             custom business transition
```

Inspect `/api/openapi` or the Developer Center for the generated request schemas, concurrency
preconditions, errors, and authentication contract. Client record IDs are branded by the model;
pass IDs returned by reads or validate external identifiers at an input boundary.

## Verify and customize

For a business invariant, use a focused database test covering success and a consequential rejection
or rollback. Standard-only additions rely on generated contracts, model checks, and exercising the
real interface. Run `pnpm check` and relevant tests; run `pnpm build` for routing, bundling, or dependency
changes. Exercise empty state, errors, relationship navigation, and file handling.

Copy the module's source and explicit dependencies to reuse it. Its model, behavior, and UI are fully
editable. Removing persisted domains requires migration and policy review. Optional deployable apps
still use `pnpm app:create` and consume the central app's public model and governed API.

## Business events

Standard Object and Link writers record committed changes automatically. Declare custom facts
beside their owning Object, register their public payload in `src/events.ts`, and append them
inside the Action's transaction. [Durable events](events.md) explains the Lead conversion example,
automatic reference visibility, replay, and browser updates. An event never executes subscribers
inside the business transaction.
