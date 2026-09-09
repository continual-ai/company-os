# Model UI

Every enabled object gets a collection page, a record page, field editors, related-record
collections, and a creation flow from the model alone. The generic routes under
`routes/_app/objects/$objectType` and `routes/_app/settings/$collection` render the standard pages in
`runtime/ui/model`; an object's `navigation.path` decides which route serves it. Modules customize
through `ObjectUi` registrations, never by adding branches to shared components.

## Record pages

Identity comes from the model's `display` (title, subtitle, status, image, icon). `record.properties`
and `record.relationships` prioritize detail fields and named relationship tabs without hiding
anything; the remaining relationships stay reachable through a searchable menu. Overview opens by
default when a record has related collections or long text and shows the newest records from each
featured relationship with authorized counts. Other tabs load when opened.

The header shows the record image or icon and title. When `display.status` names an enum with
multiple choices, it also shows a stepper. That same field provides the default Kanban grouping;
both use the enum's declared choice order. There is no extra flag or separate stage list. The
stepper shows position, not transition enforcement or evidence that earlier stages were visited.
Status remains an editable field in Details; both surfaces use the same governed field editor.

Field edits open focused dialogs that submit only the selected fields with the revision captured
when the editor opened. Full-record editing remains available. Command/Ctrl-Enter submits; a dirty
form asks before discarding; a revision conflict preserves the draft instead of overwriting or
rebasing it. Creation shows editable properties under Details and references, required parents, and
declared Links under Related records. Pickers can create a related record without losing the outer
draft. Initial links are part of the create transaction, so a failure rolls back the record and its
associations together; initializing from the non-writable direction still requires update permission
on the endpoint that owns the association.

Lists default to creation time descending, then id. Back follows browser history through related
records to the originating collection; relationship tab changes replace the current history entry.
The record header browses the most recently opened standalone collection for that object, retaining
its filters and ordering for the session. Previous and next replace the current history entry; next
loads another page when needed. The counter appears only when the record is in the loaded results.
A fresh direct link uses the default list, without scanning every page to guess a position.
Left and right arrows use the same record navigation; Escape returns to the originating collection.
Press `?` for the current page's shortcuts. Components register shortcuts with
`useKeyboardShortcuts` from `@company/ui/keyboard-shortcuts`; registrations follow their lifetime.
Handled events, typing, composition, dialogs, menus, and focused controls retain their own keys.
The command palette suggests explicitly visited records; prefetches and background refreshes do not
count as visits.

## Collection views

A view is source-owned presentation registered on the object's `collection.views`; the first view
is the default and **Reset view** restores it. Users change layout, mappings, filters, and date
window in the URL of a standalone collection or in local state when embedded. There is no saved-view
table or background write.

```ts
defineCollectionView("pipeline", "Pipeline", {
  layout: { type: "kanban", groupBy: "stage" },
  columns: ["name", "amount", "expectedCloseDate"],
})
```

| Layout   | Mapping                      | Behavior                                                                   |
| -------- | ---------------------------- | -------------------------------------------------------------------------- |
| Table    | Columns, filters, sorting    | Virtualized rows, incremental loading, inline editing, atomic batch delete |
| Feed     | None                         | One record summary per row, as Notes uses                                  |
| Kanban   | One select field             | Columns follow declared choice order; nullable fields get Unassigned       |
| Calendar | Start date, optional end     | Six-week grid, multi-day entries, mobile agenda                            |
| Gantt    | Distinct start and end dates | Date bars with range movement and end resizing                             |

Layout mappings are validated against the object during UI composition. Date-only values never
shift through a timezone; timestamps display and move in UTC. Dragging submits one revision-checked
update; a failed write keeps the confirmed record and shows the error. Output-only or immutable
mappings cannot be dragged.

All layouts use the same list queries, cache, and mutations. Calendar and Gantt add a server-side
date-window predicate. These are presentation filters, not authorization; the server filters rows
independently. Relationship collections reuse the target object's views, summaries, toolbar, and
actions; interface-target Links show heterogeneous records and need a concrete target for property
filtering and sorting.

## Extension points

`fieldEditors` replace a property editor while the shared form keeps validation, drafts, and
conflict handling; Notes supplies a Markdown editor this way. `summaryComponent` renders a record in
feeds and previews. `overviewComponent`, `additionalTabs`, and `title` extend the record page;
`toolbarComponent` adds collection controls; `actions` place a custom Action's control on rows and
records. `collection.pageComponent` and `record.pageComponent` replace a page for a distinct
workflow while the route, navigation, and client stay standard. `overview` and `related` are
reserved tab ids.

Ownership inside `runtime/ui/model`: `model-pages.tsx` selects the standard or replaced page;
`object-collection.tsx` owns the collection query and layout selection; `collection-layout.ts`
validates mappings; `object-record-page.tsx` assembles details, overview, relationships, and custom
tabs; `record-relationships.ts` binds the relationship catalog to one record's queries and supported
writes; `object-record-dialog.tsx` and `object-form.ts` own draft lifetime and submission decoding.
Rendering Markdown never executes user-supplied markup.

## Primitives

The Developer Center's Design system gallery is one page with sidebar anchors, component usage snippets, and live examples. It renders shared primitives and core application
patterns directly from their production implementations. Gallery examples live under
`app/ui/developer/design-system`; their model and records are local previews and never enter
`app.model.ts` or storage. Keep shared styling in `packages/ui` and business-aware presentation
in `runtime/ui` when extending the gallery.

The shadcn primitives live in `packages/ui` and are owned source, imported as `@company/ui/<name>`
with `cn` from `@company/ui/lib/utils`. `pnpm ui:add <component>` runs the shadcn CLI with
`packages/ui/components.json`, gives the generated `#/` imports explicit extensions, and sources
`cn` from the package instead of the registry's `cn` package. `pnpm ui:remove <component>` deletes
a primitive only when nothing in the package imports it. The design system depends on no app,
model, Effect, or TanStack code; the import rules reject a primitive that reaches into any of them.
