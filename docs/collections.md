# Collection views

A view is a source-owned presentation of an Object, not another business Object. Shared views live
in the object's `ui/config.ts` (or its adjacent `views.ts`) and are composed through `defineModuleUi`.
Users can switch layouts, choose field mappings, change filters, and pick a date window. These
adjustments live in the standalone collection URL (or local state in an embedded collection); **Reset view** restores the checked-in definition. There is no saved-view
table, personal/team sharing model, or background write when someone changes their screen.

## Define a shared view

```ts
import { defineCollectionView } from "#/ui/model/object-collection-view.ts"

const pipeline = defineCollectionView("pipeline", "Pipeline", {
  layout: { type: "kanban", groupBy: "stage" },
  columns: ["name", "amount", "expectedCloseDate"],
})

const calendar = defineCollectionView("calendar", "Calendar", {
  layout: { type: "calendar", start: "startDate", end: "endDate" },
  columns: ["name", "owner"],
})

const timeline = defineCollectionView("timeline", "Timeline", {
  layout: { type: "gantt", start: "startDate", end: "endDate" },
  columns: ["name", "status", "owner"],
})
```

Register views on their owning Object: `collection: { views: [/* ... */] }`. The first view is the
default. Omit `layout` for a table. Layout mappings are validated against the Object during UI
composition; duplicate view IDs and incompatible fields fail immediately. These examples use Deal
fields for the pipeline and Campaign fields for the calendar and timeline.

| Layout   | Mapping                           | Behavior                                                                                                |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Table    | Visible columns, filters, sorting | Virtualized rows, automatic incremental loading, inline editing, selection, atomic batch deletion       |
| Kanban   | One select field                  | Columns follow declared choice order, including empty columns; nullable fields get an Unassigned column |
| Calendar | Start date; optional end date     | Six-week month grid, multi-day entries, overflow lists, and a mobile day picker with agenda             |
| Gantt    | Distinct start and end dates      | One row per record, date bars, sticky record names, range movement, and end resizing                    |

Kanban cards show up to four selected metadata fields plus the Object's title. Use layout settings
to choose those fields. Calendar and Gantt accept date-only or timestamp fields. Date-only values
never shift through a local timezone conversion. Timestamps display and move in **UTC**; creating on
a date proposes 09:00 UTC, which can be changed in the form. End dates are inclusive at the calendar-day
level. Missing end dates render as a single-day entry. Records without a start remain in Unscheduled.

Clicking a title opens the usual record page. Edit buttons open the shared form, with its captured
etag, canonical validation, conflict errors, and discard protection. Creating from a column or date
prefills those fields in the same creation form and preserves any enclosing relationship defaults.
Drag handles support pointer, touch, and keyboard interactions through dnd-kit. Moving a scheduled
record preserves its range and timestamp time-of-day; Gantt's end handle changes only its end.
Ordinary edit controls remain available without dragging. Output-only or immutable mappings cannot
be dragged; output-only fields also disable contextual creation.

## Data and authority

All layouts use the same model list queries, QueryClient, and model mutations.
`ObjectCollection` accepts a source with a scoped list and optional create, connect, unlink, or
delete controls. A relationship binds that source from the model; layouts do not inspect Link
storage, reference fields, or ownership. Concrete targets reuse their registered collection views.
Mixed targets use the same record summaries and cursor chain without inventing shared columns. The Router preloads
the same request. Calendar and Gantt add a server-side date-window predicate, including ranges that
start earlier but overlap the window and undated records. Existing view and relationship filters
still apply. These are presentation filters, **not authorization boundaries**; the server enforces
permissions independently.

Collections initially request one bounded page. Tables load the next cursor as the viewport approaches
the last loaded rows; **Load more** remains available for keyboard users and explicit retries. Failures
retain loaded records and stop automatic loading until retried. Relationship tables follow the same
pattern. Calendar, Kanban, and Gantt keep explicit **Load more** controls within their current query.

`modelCollectionQuery` adapts the existing model list operation to TanStack Query's native infinite
queries. The Router preloads that same cache entry. Refetching rebuilds the cursor chain sequentially,
so an insertion or deletion at a page boundary does not leave a gap caused by an obsolete cursor.
Committed snapshots patch all loaded pages; server queries still determine membership, ordering,
and totals. No separate client record store is introduced.

Table rows are virtualized with TanStack Virtual. A small overscan keeps scrolling smooth, and active
cells and open editors remain mounted outside the viewport. Keyboard navigation can reveal a loaded
row outside the rendered range. Selection applies to loaded records, not an unseen server result set.
Counts describe loaded records and the server's matching total. Changing filters or sorting resets
the viewport and selection; changing visible columns does not. Loaded pages remain in the session's
query cache under its normal lifetime policy; virtualization bounds DOM work, not all cache memory.

A drop submits one revision-checked update and displays a pending state. Failed writes retain the
existing server-confirmed record and show the error. Cache updates and live events use the normal
application path; these layouts do not own a second record store or optimistic mutation protocol.

## Code boundaries

- `object-collection-view.ts` defines shared defaults and URL state.
- `collection-layout.ts` validates field mappings and derives available layout choices.
- `object-collection.tsx` assembles queries, permissions, shared dialogs, and layout selection.
- `collection-visual.tsx` coordinates drag mutations and date-window navigation.
- `collection-kanban.tsx`, `collection-calendar.tsx`, and `collection-gantt.tsx` render layouts.
- `collection-card.tsx` shares record presentation and drag/drop primitives; field values reuse the
  same semantic renderer as record details.
- `collection-dates.ts` contains pure date-window and rescheduling rules.
- `model-collection-query.ts` adapts model list queries to the shared infinite-query cache.
- `object-table-virtualization.ts` isolates row windowing and React Compiler compatibility.

Use ordinary custom React pages for workflows that need a different interaction model. These
layouts do not add a plugin registry, workflow engine, dependency scheduler, or automatic resource
leveling. Gantt bars visualize and edit the selected dates; business scheduling rules belong in
governed operations.
