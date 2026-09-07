I have what I need. Below is the complete review.

# Company OS foundation review: baseline `4bd628c` → branch `codex/company-os-foundation` (HEAD `1cea2bc` plus dirty tree)

## 1. Scope, method, and coverage

**What was reviewed.** The runtime package (`packages/runtime/src`: definitions, object/link services, model implementation, HTTP projection, client), the PostgreSQL adapter (`packages/postgres/src`), the central app's server composition (database transaction boundary, repositories, link service, authorization, events, search, seeds, migrations, transport), the client cache and query layer, the shared model UI (collections, table, record page, forms, relationship editors, summaries, recents, command palette), the module models and UI registrations for Sales, Marketing, Support, Engineering, Access and Assets, all untracked files in the inventory, the new and prior branch migrations, and the docs under `docs/`. Roughly 160 source files were read in full; the design-system example catalogue, the model explorer, the MCP transport, `effect-schema.ts`, and `api-error.ts` were only skimmed.

**Method limits.** Shell access was denied in this session, so I could not run `git diff`, `git log`, tests, or `wc`. Consequences:

- I could not mechanically separate "introduced on this branch" from "preexisting". Where I say "new", it is because the file is untracked in the inventory or appears in the modified list shown at session start; otherwise findings are stated against the current tree.
- I did not run `pnpm test`, `pnpm check`, or the build. The prior results (198 passing tests, check and build green) are taken as reported, not verified.
- No browser or live database was used. Every defect below is traced from code, and each one names the concrete trigger.

**Generated versus handwritten.** Counts below come from per-file line counts via ripgrep, not from git.

| Category                                                                        | Files | Lines  |
| ------------------------------------------------------------------------------- | ----- | ------ |
| Migration `snapshot.json` (generated, do not hand-edit)                         | 13    | 79,576 |
| of which untracked, the four newest snapshots                                   | 4     | 30,419 |
| Migration `migration.sql` (reviewed by hand)                                    | 13    | 712    |
| `apps/company-os/src/ui` (`.ts`/`.tsx`)                                         | 119   | 19,225 |
| `apps/company-os/src/server` (`.ts`)                                            | 70    | 8,474  |
| `apps/company-os/src/modules` (all files, includes 7 one-line SVGs and READMEs) | 134   | 6,006  |
| `apps/company-os/tools` (51 lines generated)                                    | 12    | 590    |
| `docs`                                                                          | 15    | 1,837  |

The four untracked snapshots match the prompt's "~30,000 generated" figure. If the baseline contained only the `initial` snapshot, the nine tracked branch snapshots contribute about 45,900 of the reported 66,881 tracked additions, leaving roughly 20,000 handwritten added lines. Treat that as an estimate; I could not confirm which snapshots existed at the baseline. The snapshots are not deletable: drizzle-kit needs the chain to generate the next migration. The largest handwritten files are `component-examples.tsx` at 1,544 lines (design-system catalogue), `model-explorer.tsx` at 892, `object-table.tsx` at 853, `effect-http.ts` at 840, and `object-table-cell.tsx` at 637. None of the collection or record files crossed 1,000 lines.

## 2. Executive verdict

The foundation is in materially better shape than most "generic CRUD scaffold" attempts: one closed model drives storage, HTTP, MCP, the typed client, cache invalidation, events and search; authorization is pushed into SQL before aggregation; writes, journal, and search index commit together; cursors are fingerprinted and precision-safe for the audit timestamps; the test suite exercises real invariants against PostgreSQL. I found no P0 and no data-corruption or privilege-escalation bug.

What I did find is a stack that is carrying **two vocabularies for the same thing in four places**: two read permissions deciding row visibility depending on how a relationship is stored; three implementations of "list the records on the other side of a relationship" in the UI; a relationship catalog that the runtime unifies and the UI immediately splits back into "traversals" and "references"; and an `initializable` concept that produces a non-atomic create-then-link path in the most common flow. The relationship-scoped `ObjectCollection` adapter and the Link delegation to the object query compiler are the right direction, but both stopped one layer too early: the server still fetches every relationship page twice, and the UI still keeps the legacy relationship list alive for interface targets and for a row dialog nobody needs.

**Highest-leverage next changes, in order:**

1. **Finish the Link-to-object-list delegation on the server.** Have the runtime Link service call the target object's repository `list` with `relatedTo` and return full records; keep the edge repository only for interface targets; stop re-hydrating through `batchGet`; stop constructing a repository and compiling schemas per request; compute target visibility with one `readableScopes` query. Deletes code, halves relationship-page I/O.
2. **One permission for row visibility.** Make `get` the visibility predicate everywhere and make `list` a collection gate that is actually checked. Today collections filter by `list` grants while relationship tabs, search and events filter by `get`.
3. **Make relationship initialization symmetric and delete `initializable`.** Allow `links` on create for any traversal; when the traversal is not the writable side, authorize `update` on the other endpoint. This removes the non-atomic create-then-link fallback, three UI branches, and a documented caveat.
4. **One relationship catalog in the UI.** Derive `{ key, label, list, createDefaults, featured }` once from `modelRelationships(Model)` and consume it in the record page, previews, and the New related menu. Delete the legacy `Relationship`, `ObjectRelationships`, `ObjectRelationshipsDialog`, and `ObjectRelationshipForm`.
5. **Converge interface projections at migrate time** instead of hand-writing backfill migrations and tests each time an object gains an interface.

## 3. Confirmed defects

Severity here reflects user or operator impact. Structural ranking is in section 4.

### P1

**B1. Every concrete-target relationship page is fetched twice and re-authorized twice; the object repository is rebuilt per request.**
Files: `packages/postgres/src/link-repository.ts:262-304`, `packages/runtime/src/effect-model-implementation.ts:299-340`.
Trigger: any relationship tab, preview count, or `GET /api/v1/companies/{id}/contacts`.
Trace: `LinkRepository.list` calls `makeObjectRepository(storage, target, db, pageTokens)` on every invocation (line 266), which runs `makeRepository`: table lookup, column map, `toEffectObjectSchema(object)` compilation, query-compiler construction. It then runs the full record `select ... limit size+1` and `decodeRecords`, and throws the records away, keeping only `{ id, objectType }` (lines 297-303). `executeModelOperation` then calls `batchGet` per object type (lines 305-323), which runs `authorize("batchGet")` (two authorization queries: `getTargets`, `listGrants`) and a second full `select` plus decode of the same rows. Net cost per page: one grants query, one select, one count, two authorization queries, one select, plus schema compilation. The trailing `import { createHash } from "node:crypto"` at `link-repository.ts:443` after the export is a symptom of the file having grown past its design.
Impact: roughly double database I/O and CPU on the hottest read path in the record workspace, and defect-class errors ("does not have a PostgreSQL storage table") deferred from startup to request time.
Remedy: see S1. Minimal version: give `makeLinkRepository` the already-constructed object repositories (or a `list` function per object) and return `Page<ObjectRecord>` for concrete targets; make `executeModelOperation` hydrate only `ObjectRef` pages.
Validation: a database test asserting that a `company.contacts.list` with a concrete target issues exactly one record select (count statements via `pg_stat_statements` or a Drizzle logger spy), and that items are full records without a `batchGet` call.

**B2. Row visibility is governed by `list` grants for collections and `get` grants for relationship tabs, search, and events.**
Files: `packages/runtime/src/effect-object-service.ts:535-552`, `apps/company-os/src/server/authorization/authorization-service.ts:252-265`, `apps/company-os/src/server/authorization/permission-catalog.ts:24-30`, `apps/company-os/src/server/model/link-service.ts:125-142`, `apps/company-os/src/server/model/search-records.ts:23`, `apps/company-os/src/server/events/event-journal.ts:52`.
Trigger: a role with `contact.get` but not `contact.list`, or the reverse. Neither built-in role hits this because Operator and Administrator hold both, which is why tests pass.
Trace: standard `list` never calls `authorize`; it only asks `visibleWithin({ operation: "list" })`, which `objectPermission` maps to `contact.list`. Link lists call `visibleWithin({ operation: "get" })`. `ObjectReferenceCollection` on the record page uses standard `list`, so a company's "Leads" tab (a reference) filters by `lead.list` while its "Contacts" tab (a Link) filters by `contact.get`. Search and the journal use `get`.
Impact: a customer defining a "sees only assigned records" role gets rows in relationship tabs and search but an empty collection, or vice versa, depending on which relationship storage the model author chose. Storage kind leaks into policy.
Remedy: one visibility permission (`get`) for every row predicate. Make `list` a gate: `authorize("list")` with no targets before querying, or remove `list` from the permission vocabulary entirely. Then `permissionOperation` for `list` disappears.
Validation: database test where a principal has only `contact.get` at one company: assert `contact.list`, `company.contacts.list`, `records:search`, and events return the same set.

**B3. "New related" from the non-writable side is a non-atomic create-then-link, and this is the common case.**
Files: `packages/runtime/src/definition/model.ts:844-846`, `apps/company-os/src/server/model/link-service.ts:143-171`, `apps/company-os/src/ui/model/object-relationship-collection.tsx:113-135`, `docs/record-workspaces.md:88-90`.
Trigger: Company record → Contacts tab → New contact. `ContactCompanies.writeFrom` is `contacts` (company side). The inverse traversal `contact.companies` is `many` and not `writeFrom`, so `initializable` is false; the UI falls to `onCreated: connect(created.id)`, two separate HTTP operations.
Impact: a failed second call leaves an orphaned contact that is not shown in the tab and offers no retry affordance. The documentation codifies this as intended.
Remedy: see S3. Drop `initializable`; accept `links` for any traversal on create; when the traversal is not the writable side, authorize `update` on the opposite endpoint (the writable source) in `Links.authorize` for `initialize`. Then `object-relationship-collection.tsx` always passes `initialValues.links` and the `onCreated` branch is deleted.
Validation: HTTP test creating a contact with `links: { companies: [companyId] }` as a caller with `contact.create` and `company.update` succeeds atomically; the same call without `company.update` is denied and creates nothing.

### P2

**B4. Link-list target visibility runs one grants query per implementing object type.**
File: `apps/company-os/src/server/model/link-service.ts:125-142`.
Trigger: `note.subjects.list` or any traversal targeting `NoteSubject`, which has 15 implementers.
Trace: `Effect.forEach` over `modelObjects(Model).filter(accepts)` calling `authorization.visibleWithin` each time; `Effect.forEach` is sequential by default. `Authorization.readableScopes` at `authorization-service.ts:268-293` already returns all `X.get` scopes in one query.
Remedy: `visibility = readableScopes()` filtered to accepting types. One query.
Validation: assert one `listGrants` call for a `note.subjects.list`.

**B5. Home "Recently opened" is populated by hover preloads and reordered by other users' edits.**
Files: `apps/company-os/src/ui/application/use-recent-records.ts:8-33`, `apps/company-os/src/router.tsx:16`, `apps/company-os/src/ui/model/object-routing.ts:33-40`, `apps/company-os/src/customization/home.tsx:67-69`.
Trigger: hover any record link (router `defaultPreload: "intent"` runs `preloadObject`, which `ensureQueryData`s the `get`); or receive an SSE snapshot for a cached record (`setQueryData` bumps `dataUpdatedAt`).
Trace: recents are inferred from every successful `get` query in the cache sorted by `dataUpdatedAt`, reading `queryKey[1]` and `queryKey[3]` positionally.
Impact: the list contradicts its own copy ("Records you open appear here") and jumps when teammates edit.
Remedy: record opens explicitly in `ObjectRecordPage` into a tiny in-memory list (or `sessionStorage`), keyed by identity, and render that. Delete the cache-scraping and the positional key parsing.
Validation: unit test that a preload does not register an open and that an open does.

**B6. The built-in Operator role cannot resolve users, so every author and owner label is unresolvable.**
Files: `apps/company-os/src/server/authorization/permission-catalog.ts:104-128`, `apps/company-os/src/ui/model/record-attribution.tsx:18-32`, `apps/company-os/src/ui/model/object-references.ts:45-55`.
Trigger: sign in as an Operator, open Notes or any object with an `owner: User` reference.
Trace: `operatorObjectTypes` omits `user`, so `user.list` is not granted; `visibleWithin` returns `[]`; `RecordAttribution` and `useObjectReferences` list queries return empty pages; the UI shows "Unavailable author" and raw IDs.
Impact: the non-admin demo persona sees broken attribution everywhere.
Remedy: grant `user.get` and `user.list` to Operator, and move this role definition out of a hardcoded object-type list (see S8).
Validation: database test that the Operator role can `user.list` the users referenced by readable records.

**B7. `RecordAttribution` issues one `list` per actor type per distinct author, per rendered summary.**
File: `apps/company-os/src/ui/model/record-attribution.tsx:18-32`.
Trigger: Notes feed with several authors.
Trace: three `list` queries (`user`, `serviceAccount`, `anonymousActor`) with `id eq author`; TanStack dedupes identical keys, so cost is authors × 3, but the canonical batching helper `useObjectReferences` already exists and already resolves `parent` and every `recordId` property in one `in` query per type.
Remedy: extend `useObjectReferences` to collect `createdBy` and `updatedBy`, and pass `references` into the summary props so `RecordAttribution` becomes pure presentation.
Validation: render a feed of 50 notes by 8 authors and assert three network requests, not 24.

**B8. Per-record `canUpdate(recordId)` and `canDelete(recordId)` ignore the record.**
File: `apps/company-os/src/ui/model/use-object-collection.ts:99-107`.
Trace: when a target is supplied, `can` returns the untargeted capability ("has this permission anywhere"). Edit affordances therefore appear on rows the caller cannot update; the server denies afterwards and the cell shows an error. `useObjectRecord` does the targeted check correctly via `objectCapabilityChecks`.
Remedy: either batch targeted checks for the loaded page (bounded by `MAX_CAPABILITY_CHECKS`, chunked) or rename to `canUpdateAny` so the contract is honest. The first is cheap: 50 checks per page in one request.
Validation: unit test with a capability stub that returns true for the untargeted check and false for record B; assert `canUpdate("B")` is false.

**B9. Inverse reference keys declared in the model are not used for tab keys and are never validated for collisions.**
Files: `apps/company-os/src/ui/model/object-reference-metadata.ts:22`, `packages/runtime/src/definition/relationship.ts:57-71`, `packages/runtime/src/definition/model.ts:711-745`.
Trace: `Lead.company` declares `inverse: { key: "leads" }`. The record page, URL `?tab=`, and `ObjectUi.record.relationships` use `relationship.id`, which is `lead.company`. Link tabs use the traversal key (`contacts`). Authors must therefore write `relationships: ["contacts", "lead.company"]`, mixing two vocabularies, while the declared `leads` is dead. `defineModel` validates link traversal keys against properties and methods but never checks reference `inverse.key` uniqueness or collisions with link traversal keys on the same target.
Remedy: use `relationship.reverse.key` as the tab key for references; validate inverse keys in `defineModel` with the same rules as traversal keys.
Validation: model test that two references with the same explicit inverse key on one target fail at `defineModel`; UI test that `?tab=leads` selects the Leads collection.

**B10. Deep-scrolled collections refetch every loaded page on each incoming event page for their type.**
Files: `apps/company-os/src/model-cache.ts:53-116`, `apps/company-os/src/model-collection-query.ts:6-23`.
Trace: `applyModelChanges` patches pages, then `invalidateModelQueries` refetches the infinite query, which rebuilds the cursor chain sequentially. A user 10 pages deep into Contacts triggers 10 sequential requests per event page touching contacts. `cancelQueries` also aborts an in-flight `fetchNextPage`; tables recover via the scroll effect, Kanban and Calendar require another click on Load more.
Impact: bounded by page depth, but multiplies under active team editing. Hypothesis on magnitude; mechanism confirmed.
Remedy: coalesce invalidations per type with a short debounce, and skip invalidating a query whose only change was already patched (created events still need membership refresh). Do not add `maxPages`; it breaks virtualization.
Validation: cache test asserting one refetch after three event pages arriving within the debounce window.

### P3

**B11. Feed-only delete and layout-specific affordances in the shared collection.**
File: `apps/company-os/src/ui/model/object-collection.tsx:233-242`.
A record can be deleted from Feed cards and from Table selection, but not from Kanban, Calendar, or Gantt cards, which call the same `renderActions`. This is a hidden mode branch.

**B12. Latent authorization asymmetry for singular non-writable traversals.**
Files: `packages/runtime/src/definition/model.ts:844-846`, `apps/company-os/src/server/model/link-service.ts:144-150`.
A `one` or `zeroOrOne` traversal that is not `writeFrom` is initializable at create with only `get` on the target, yet can never be changed from that side afterwards. Not reachable in the shipped model (every singular side is `writeFrom`), but a customer defining such a link will hit it. Fixed by S3.

**B13. Property timestamp cursors lose sub-millisecond precision.**
Files: `packages/postgres/src/object-repository.ts:474-480`, `packages/runtime/src/definition/schema.ts:11-12`.
Only `createdAt` and `updatedAt` use `::text` cursor values. Sorting by a property timestamp such as `ticket.respondByAt` uses the decoded record value, which the driver truncates to milliseconds. The `Timestamp` brand accepts arbitrary fractional digits, so an API caller can store microsecond values and pagination on that sort can skip or repeat rows at a boundary. Low probability; remedy is to emit `::text` cursor columns for every timestamp sort field, or normalize timestamps to milliseconds on write.

**B14. `InvalidLinkRequest` swallows the typed failure from alias resolution.**
File: `packages/runtime/src/effect-link-service.ts:443-454`. A `RecordAliasNotFound` inside a relationship filter becomes "The relationship query is invalid." Map only schema errors; let alias failures pass through.

**B15. Performance seed scale is unverified against its documented ceiling.**
Files: `apps/company-os/src/server/seeds/run-seed-scenario.ts:32-65`, `apps/company-os/src/modules/sales/server/performance-seed.ts:50-111`, `docs/runbooks/demo-data.md:29`.
The whole scenario is one transaction. At size 10,000 that is about 50,000 governed operations, each with authorization queries and a savepoint, roughly 100,000 staged events held in memory as structured clones, a single `updateSearchIndex` with `IN` lists of tens of thousands of IDs, and one `flushEvents` insert. The test covers size 60. The `Object.assign(tx, { $client: database.$client })` at line 55 mutates the transaction handle to impersonate a `Database`. Hypothesis: works, but slow and memory-heavy at the top of the range. Either lower the documented ceiling until measured, or chunk large scenarios into per-batch transactions with a receipt per batch.

## 4. Structural simplifications

Ordered by leverage. Line estimates are labeled as estimates.

### S1. Let the Link service delegate to the target object repository and delete the object branch of `LinkRepository.list`

Today: `LinkRepository.list` (`packages/postgres/src/link-repository.ts:257-413`) has two branches. The concrete-target branch rebuilds an object repository per call, runs the object list with `relatedTo`, and degrades records to refs. The interface branch runs its own cursor and count queries. `LinkService.list` (`effect-link-service.ts:415-469`) then passes the result to `executeModelOperation`, which hydrates refs through `batchGet`.

Proposed: `LinkService.list` receives the target object's repository from the caller (the app already holds `ObjectRepositories`) and, for a concrete target, calls `repository.list({ ...query, relatedTo }, { visibleWithin })` directly, returning `Page<ObjectRecord>`. `LinkRepository` keeps `link`, `unlink`, and a `listRefs` used only for interface targets. `executeModelOperation` hydrates only when items are refs. Delete the per-call `makeObjectRepository`, the refs mapping, and the trailing import. Behavior preserved: filter, sort, cursor fingerprint including `relatedTo`, exact visible totals. Estimated deletion: 60 to 80 lines net, plus half the queries on the path. Risk: low; the object-service test at `object-service-database.test.ts:62-127` already covers this contract.

### S2. One visibility permission

Described in B2. Concretely: `Authorization.visibleWithin` takes an object type only and always uses `get`; `effect-object-service.ts` `list` calls `authorize("list")` as a gate if `list` is retained; `permissionOperation` loses its `list` special case. `readableScopes` becomes the single implementation and `visibleWithin` a projection of it. Estimated deletion: small, but it removes a whole class of policy surprises.

### S3. Delete `initializable`; make create-time `links` symmetric

Described in B3 and B12. Runtime: `modelObjectLinkTraversals` drops `initializable`; `LinkWriter.initialize` accepts every traversal; the app's `Links.authorize` for `initialize` requires `update` on the writable side's source when the traversal is not writable. UI: `object-relationship-collection.tsx:113-135` always passes `initialValues.links`; delete `connect`, `pending`, `error` state for the create path; `record-related-create-menu.tsx:85-91` drops the `inverse?.initializable` filter; `object-form.ts:57-64` `objectFormLinks("create")` returns all traversals. Docs: remove the create-then-link caveat. Estimated deletion: about 60 lines and one concept. Risk: medium; it changes an authorization rule, so it needs the tests in B3.

### S4. One relationship catalog in the UI, one relationship renderer

Today three places re-derive "is this a Link traversal or a reference?": `object-record-page.tsx:74-99` and `357-386`, `use-record-relationship-previews.ts:29-49`, `record-related-create-menu.tsx:58-109`. And three components list related records: `Relationship` in `object-relationships.tsx:49-283` with its own `pageTokens` state and `useQueries` pagination, `ObjectLinkEditField` at `object-link-edit-field.tsx:71-96` with the same hand-rolled pagination, and `useObjectCollection` with `modelCollectionQuery`. The legacy `Relationship` survives for interface targets on the record page and for the row-level "Manage relationships" dialog (`object-collection.tsx:201-213`, `536-545`), which duplicates the record page in a modal.

Proposed: a UI-side `recordRelationships(object)` derived from `modelRelationships(Model)` yielding `{ key, label, description, featured, list(recordId, request), createOptions(recordId) }`, where `list` is either the link client or a fixed-filter object list. Record page tabs, previews, counts, and the New related menu consume that one shape. `ObjectRecordFeed` accepts heterogeneous `ClientRecord & ObjectRef` items and resolves the object per record (it already dispatches `ObjectRecordSummary` per object), so interface targets render through `ObjectCollection` in feed layout. Then delete `object-relationships.tsx`, `object-relationships-dialog.tsx`, `object-relationship-form.tsx`, and the row dialog button, and rebuild `ObjectLinkEditField`'s member list on `modelCollectionQuery`. Estimated deletion: roughly 550 lines and two pagination implementations. Risk: medium; interface-target lists need a feed layout that tolerates mixed types, which `ObjectRecordSummary` already does.

### S5. Reshape `ObjectCollection` props as capabilities, not a relationship mode

`object-collection.tsx:76-97` takes `relationship?: { list, create: ObjectCreateOptions | false, renderAdd, unlink? }` plus separate `fixedFilters`, `createInitialValues`, `createReferenceLabels`. Seven branches test `relationship === undefined` or `relationship?.create !== false` (lines 174, 201, 214, 233, 375, 381, 382). Proposed: one `source` prop `{ list, create?: ObjectCreateOptions, unlink?, addControl?, batchDelete?: boolean }`; standalone pages construct a source too. Branches become presence checks on the capability the source actually supplies, and `enableRowSelection` follows `batchDelete`. This also fixes B11 by letting the source decide whether records are deletable rather than the layout. Estimated deletion: 30 to 40 lines; the win is legibility, not size.

### S6. Converge interface projections at migrate time

`20260906225902_issue-note-subjects/migration.sql` and `issue-note-subjects-migration-database.test.ts` exist because Issue gained `implements: [NoteSubject]` and existing rows lacked `interface_note_subject` entries. Every future `implements` addition needs the same hand-written pair. The repository already knows the rule (`packages/postgres/src/object-repository.ts:583-588`), and `db-migrate.ts:116-126` already has the precedent of a model-derived convergence step in `ensureSearchIndex`. Proposed: `ensureInterfaceProjections(database)` that, for each object and implemented interface, runs `insert into interface_x (id) select id from <object table> on conflict do nothing`, executed after `applyMigrations`. Delete the hand-written data migration pattern going forward and the dedicated test. Estimated deletion: the migration plus a 70-line test per future interface change.

### S7. Return applied edge changes from `LinkRepository` instead of snapshot-diffing

`trackedLinkRepository.mutate` (`apps/company-os/src/server/model/link-service.ts:20-114`) computes the link "family", snapshots every edge touching either endpoint across all family tables before and after, and diffs to emit `linked`/`unlinked` events. The PostgreSQL `link` already knows exactly what it did: nothing (existing pair), replaced singular edges (deleted rows), inserted. Proposed: `LinkRepository.link`/`unlink` return `{ linked: Pair[], unlinked: Pair[] }`, including cascaded subset removals (the repository can select the subset rows it will delete). Events derive from return values; the superset-first ordering for `subsetOf` stays explicit. Deletes the snapshot machinery and two selects per family link per mutation. Risk: medium; `event-journal-database.test.ts:139-167` covers the expected event set.

### S8. Remove domain-specific lists from shared policy and cache code

`permission-catalog.ts:104-113` hardcodes Sales, Engineering and Asset object IDs as the Operator role's scope; Marketing and Support objects are invisible to Operators, and B6 follows from the same list. `data-client.ts:50-56` hardcodes five Access object IDs as "permission-affecting types". Proposed: an object-level or module-level declaration (for example `access: "business"` versus `access: "system"` on `defineObject`, or a module `roles` contribution seeded by the Access module) from which both the Operator permissions and the client's permission-reset set derive. This is exactly the "object-specific branch in a generic component" the product intent forbids.

### S9. Collapse the twelve `_sales` route files into the generic object routes

`apps/company-os/src/routes/_app/_sales/{companies,contacts,deals,leads,notes}/{index,$recordId}.tsx` are byte-for-byte the same as `routes/_app/objects/$objectType/{index,$recordId}.tsx` except for the object constant and page copy; `line-items.tsx` is a third variant without URL state. They exist only to give pretty paths that `ObjectUi.navigation.path` already declares. Proposed: one aliased param route (`/$collection/` validated against navigation paths) or simply the generic route, and delete 13 files. Estimated deletion: about 350 lines. Risk: low; the routeTree is generated.

### S10. Shared heuristics that appear twice

`object-record-page.tsx:159-169` and `object-form-property-field.tsx:365-368` both decide "long text" as string without format and `maxLength > 300`. `object-properties-card.tsx:58-59` keeps a third list of "directly editable kinds". One `isLongText(property)` helper, or a portable `schema.text()` hint, removes the magic number and the drift risk.

### S11. What should not be split or refactored yet

- `object-table.tsx` at 853 lines is large but cohesive: header rendering, virtualized body, and cell wiring belong together; `object-table-cell.tsx`, `-navigation.ts`, `-virtualization.ts`, `-config.ts` are already extracted. Do not split further without a concrete second consumer.
- `effect-http.ts` at 840 lines is the one deliberate dynamic bridge and is well-commented. Leave it.
- `component-examples.tsx` at 1,544 lines is a design-system catalogue; splitting it would move complexity without removing it.
- Do not introduce a plugin registry, a saved-view table, a client record store, or a second schema to address any finding above. Every remedy here deletes a path or moves logic to the layer that already owns it.

## 5. Naming and consistency

Only items that change the authoring or model experience.

- **`get` versus `list` as visibility**: resolved by S2. The vocabulary should be "read" for rows and "enumerate" for the collection gate if both survive.
- **Relationship tab keys**: link traversals use the traversal key, references use `source.property`; the declared `inverse.key` is ignored (B9). Use `reverse.key` everywhere and validate it in `defineModel`.
- **`ModelLinkTraversal.traversal`**: `traversal.traversal.key` appears dozens of times. The type-level helpers already say `side` and `target`; rename the runtime field to `side`. Mechanical, broad, worth doing during S4.
- **Three meanings of "search"**: `ObjectCollectionSearch` is URL view state (`object-collection-view.ts:37-40`), `CollectionSearch` is a title filter box, `records.search` is global search. Rename the URL type to `CollectionViewSelection` or `CollectionQueryState`.
- **`Party` interface** (`modules/sales/interfaces/party.ts`) has property mappings but no Link or reference targets it; `NoteSubject` took its role. Delete it or give it a consumer; it is speculative model surface and shows up in tests as hand-inserted rows.
- **Migration names**: `amused_luckman`, `fixed_nightmare`, `freezing_night_nurse`, `hard_jigsaw`, `handy_pixie`, `wealthy_unicorn`, `public_la_nuit` sit beside `sales-relationships`, `issue-note-subjects`, `contact-marketing-status`. The runbook already says to pass `--name`. Applied migrations must never be renamed; enforce the name going forward. If this branch has never migrated a shared database, consider squashing `wealthy_unicorn` and `public_la_nuit`, which create and then drop eighteen GIN indexes within the same day.
- **Choice colors**: `object-choice-badge.tsx:5-25` maps the portable `ChoiceColor` to raw Tailwind palette classes in the app, and `collection-kanban.tsx:47` repurposes `--chart-N` tokens for column dots. Move the color mapping to `@company/ui` tokens so themes can override.

## 6. Ordered sequence

**Quick fixes, each under a day, independent:**

1. B4: `Links.visibility` from `readableScopes`.
2. B6: grant Operator `user.get`/`user.list`; then S8 to remove the hardcoded list.
3. B5: explicit recents store; delete cache scraping.
4. B14: stop swallowing alias failures in link list.
5. B8: targeted `canUpdate`/`canDelete` or honest names.
6. B9 validation half: `defineModel` inverse-key checks.

**Deeper, sequenced because each removes a prerequisite for the next:**

7. S1 with B1: server-side Link list delegation returning records; then S7 if the event snapshot diff still feels heavy after S1.
8. S2 with B2: one visibility permission.
9. S3 with B3: symmetric initialization; delete `initializable`.
10. S4: one UI relationship catalog and renderer; delete the legacy relationship list, dialog, and form; B9 tab-key half lands here.
11. S5: capability-shaped `ObjectCollection` props; B11 disappears.
12. S6: interface projection convergence in `db:migrate`.
13. S9: route collapse.
14. B7 and S10 as cleanup once S4 settles the summary props.

**Do not touch without more evidence:** B10 (measure first), B15 (measure at 10,000 or lower the documented ceiling), B13 (only if microsecond timestamps appear in practice), the table internals, and the HTTP bridge.

## 7. Validation performed and remaining uncertainty

**Performed.** Static reading of the files cited above, tracing each defect to a reachable trigger in the shipped model or API. Confirmed by reading that: the transaction wrapper releases savepoints and threads a per-savepoint event buffer; the flush allocates positions under a single row lock; the search index is updated before the flush; cursor conditions handle `nulls first/last` and ties correctly; fingerprints include `relatedTo` so relationship cursors cannot be replayed against collections; `batchDelete` is atomic and records tombstones before cascades; `ContactPrimaryCompany` links its superset first and cascades on membership removal; the seed scenario commits records, links, assets, events, and its receipt in one transaction and refuses parameter changes.

**Not performed.** No tests, lint, typecheck, or build were run by me. No browser verification. No git diff, so preexisting-versus-new attribution is by inventory and the modified-file snapshot only. Line counts for `packages/*` were not machine-counted because the glob failed; the figures in section 1 for packages are from the files I read.

**Open questions.**

- Whether `pnpm check` accepts the `import` after code at `link-repository.ts:443`; it may be tolerated by the current lint config.
- Actual cost of `toEffectObjectSchema` compilation per relationship request (B1); mechanism confirmed, magnitude not measured.
- Seed behavior above size 60 (B15).

**Designs that should survive simplification.** The closed-model definition and validation in `packages/runtime/src/definition`; `modelRelationships` as the single relationship catalog; the query compiler and fingerprinted cursors in `packages/postgres/src/object-query.ts`; the transaction-scoped event buffer, search-index update, and flush ordering in `database.ts`, `search-index.ts`, `flush-events.ts`; batched authorization `decide` with SQL-side scope predicates; `modelCollectionQuery` and the `applyModelChanges` reconciler; `defineModuleUi` typed registration with composition-time validation; `ObjectCollection` as the one collection renderer; `seed_runs` receipts; the template-clone test database; the runtime patches documented in `patches/README.md`. Every recommendation above deletes a competing path and routes behavior through one of these.
