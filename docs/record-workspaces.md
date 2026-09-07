# Record workspaces

Every standard object gets the same full record page, field editors, related
records, and creation flow. The model supplies identity, field semantics, relationship directions,
and operation contracts. No UI registration is required for the default experience.

Record links navigate to canonical pages inside the application shell and support opening in
another tab. The sidebar stays available. The header provides a back arrow and a collection /
record breadcrumb. Back follows browser history through related records to the originating
collection; a direct entry with no previous app history falls back to the object's collection.
The collection breadcrumb always opens that collection directly.

Collection filters and view selection stay in the originating URL, and TanStack Router restores
scroll positions. Relationship tab selection lives in the record URL and replaces the current
history entry, so Back returns to the previous record rather than stepping through tab changes.
All standard routes render `ModelRecordPage`, including object-owned page replacements. On narrow
screens, record details and related content stack. The Details control collapses the property pane
when more workspace is useful; Record options contains Copy record ID.

## Optional presentation choices

Reusable identity belongs in the model's `display` configuration: title, image, subtitle, status,
and icon. Application-specific composition belongs in the object's `ui/config.ts`:

```ts
export const companyUi = {
  record: {
    properties: ["domain", "industry", "lifecycleStage", "website"],
    relationships: ["contacts", "deals", "notes"],
  },
} satisfies ObjectUi<typeof Model.objects.company>
```

Property names are checked by TypeScript. Composition validates relationship keys against the
model's relationship catalog. These arrays prioritize detail fields and directly named relationship
tabs; they do not remove fields, relationships, permissions, or API capabilities.

All detail fields remain visible, prioritizing configured fields, display status, and subtitle.
Long text appears in the main reading area. Up to four relationships appear as named tabs;
additional relationships are available in a searchable More relationships menu. Default tab
selection skips hidden navigation targets and broad interface-based ownership collections when
other relationships exist. Explicit configuration can prioritize any relationship.

Overview opens by default when a record has related collections or long text. It shows the three
newest records from each featured relationship, with links to the full collections. The same
bounded, authorized list requests supply total-count pills on the named tabs. Counts are not
inferred from the preview length; loading and failed requests are distinct from empty collections.
These requests share normal cache invalidation with the collections. Other relationships load
only when opened, and only the active tab mounts its full collection controls.

Lists default to creation time descending, then ID descending. Explicit view or user sorts take
precedence. The starter views use this default except where they specify a meaningful business
order, such as expected close date. Pagination preserves timestamp precision and stable ties.

Use `summaryComponent`, `title`, `overviewComponent`, `additionalTabs`, `fieldEditors`, and `pageComponent` when
the business requires custom React. `overview` and `related` are reserved tab names. There is no
runtime page builder or second model definition.

## Editing and creation

Record properties open focused dialogs; the details rail and narrative content stay in place.
Ordinary scalar values open the editor when clicked. References and specialized values expose an
edit button so their links remain navigable. The dialog identifies the field and record, and uses
the same TanStack Form controls, Effect decoder, and API-error boundary as the full editor.
Tables retain compact cell editing without changing row height or column width. Focused updates include only
the selected fields and the revision captured when the editor opened. They cannot accidentally
submit unrelated fields or relationship drafts. Full-record editing remains available. Only one focused editor can be open at a time.

Command/Ctrl-Enter submits the form. Invalid values keep the form open and identify the field;
closing a dirty form asks before discarding it. A revision conflict preserves the unsaved draft.
It does not automatically overwrite the newer version or silently rebase the draft.

Creation shows all editable fields. Ordinary properties appear under Details; record references,
required parents, and declared Links share Related records during creation. Editing exposes only the
relationship's declared writable side. Single targets use one searchable picker,
while multiple targets use removable selections. Nullable selections can be cleared. Both pickers
support creating a target through its standard form. Only relationships supported by the operation
contract appear; reverse collections do not imply arbitrary writes to existing records. Defaults
remain owned by the shared form and model.

The record header groups custom actions, a New related menu, and full-record editing. New related
offers featured relationships whose create contract can initialize the connection atomically;
other connection workflows remain available in the full relationship tab.

The standard create envelope accepts initial links from either direction. The transaction includes
the record, its associations, and their events. Initializing from the non-writable direction still
requires update permission on the existing endpoint that owns the association. A failure rolls back
the entire creation; UI callbacks do not coordinate this transaction.

A New record action can initialize the reciprocal relationship as part of the standard create
transaction. Existing records connect through the standard picker. Reverse views invoke the
relationship's declared writable side, preserving its server authorization. Loaded existing members
are disabled in its options. The server remains authoritative for membership and permissions,
including records beyond the loaded window. The collection's Add picker selects existing records;
New uses the atomic create envelope. Pickers inside unsaved forms can create a standalone target
and select it into the draft; cancelling that parent draft does not delete the newly created target.

## Component ownership

- `model-pages.tsx` selects the standard or explicitly replaced page.
- `object-collection.tsx` owns the collection query; record identities use ordinary router links.
- `site-header.tsx` renders record breadcrumbs and uses router history for Back.
- `record-relationships.ts` binds the model relationship catalog to one record's queries, create defaults,
  and supported mutations. References, ownership and Links retain their distinct write rules here.
- `object-record-page.tsx` assembles details, overview, relationships, and custom tabs.
- `record-relationship-picker.tsx` provides search for relationships beyond the visible tabs.
- `object-record-dialog.tsx` and `object-form.ts` own draft lifetime and submission decoding.
- `object-record-identity.tsx` and `object-choice-badge.tsx` keep identities and choice colors consistent.

The command palette suggests explicitly visited records from the authenticated app shell's session
history. Prefetches, reference resolution, and background refreshes do not create visits. Records
are revalidated before appearing; changing identity clears the navigation history.

## Notes as a composed presentation

The Note module registers its Markdown field editor, record title, overview, and summary in
`ui/config.ts`. Its default collection layout is `feed`; a Table view remains available. The same
summary renders in the standalone feed, related collections, and bounded overview previews.
Summaries receive the canonical record, destination link, presentation variant, resolved author, and owner-supplied
actions. Author and reference labels are batched by the collection or overview owner. They do not replace collection loading, pagination, permission checks, or mutations.
Reference and concrete-target Link collections both use `ObjectCollection`, inheriting the target's
views, custom summaries, toolbar, and record actions. Link adapters supply only scoped loading,
creation context, and Add/Unlink operations. Related collections do not offer bulk record deletion.
The default summary shows the model's title, image, subtitle, and status without custom React.

Concrete-target Links reuse the Object query compiler for server-side filtering, sorting, exact
visible totals, and cursor pagination. Cursor tokens are bound to the relationship and query.
Interface-target Links retain heterogeneous record lists and pagination; property filtering and
sorting require a concrete target. Pagination controls sit outside the horizontally scrolling data.

Notes store Markdown in the existing content field. The shared UI editor supplies formatting
shortcuts and a preview, while the standard form continues to own validation, drafts, revision
conflicts, and initial relationships. Creating from a record initializes its subject link in the
same operation. Author and creation time use the record's audit metadata; actor names resolve
through authorized cached reads without blocking the note body. Raw HTML is not rendered, and
remote images appear as links. Rendering Markdown never executes user-supplied markup.
