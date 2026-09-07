# Company OS and Attio experience review

Reviewed September 6, 2026. This is an assessment and proposed sequence, not a description of shipped changes.

## Assessment

Attio currently offers a substantially more coherent everyday record experience. Company OS has useful technical foundations, but its default interface still exposes too much of the model's structure and too little of the work someone is trying to do.

The largest opportunity is continuity: find something, inspect it without losing your place, change a field, connect another record, take an action, and understand what happened. Better typography and surfaces matter, but cannot substitute for that interaction loop.

Source ownership is a valuable architectural distinction. It becomes an end-user advantage when a business can add its own operation to this loop without rebuilding navigation, forms, authorization, data access, and activity history. It does not establish UX superiority on its own.

## Evidence and limits

Inspected the signed-in [Attio Companies view](https://app.attio.com/continual/companies/view/14ebc856-93f9-48c3-b36e-18bb9854fd8b), record overview and edit dialog, record actions, view settings, relationship filter traversal, global search, create form and relationship picker, and selected-record toolbar. Menus and dialogs were closed and selection cleared. No records, saved views, emails, or workflows were changed.

Compared the local Company OS Companies collection, company detail and related contacts, link picker, creation form, global search, filter picker, and narrow-screen record layout. Cross-checked the shared renderers, UI extension contract, client/cache documentation, and search implementation. Earlier calendar, Gantt, and developer-center fixes remain separate work.

Attio's view contained 1,440 companies; our local Companies view contained one demo company. This is not a comparative performance benchmark. Actual Attio mutations, undo, merge correctness, automation execution, and mobile behavior were not tested. Visible controls establish available affordances, not their reliability.

## What to adopt and improve

| Area                  | Observed Attio behavior                                                                | Company OS today                                                                                    | Recommended direction                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Record navigation     | Overlay workspace, collection position, previous/next, close back to the collection    | Standalone record page; collection links target the base collection route                           | One record workspace, usable as a context-preserving preview and a direct full page                                     |
| Record hierarchy      | Identity/properties rail beside highlights, activity, emails, notes, and tasks         | Large properties card and eleven company relationship tabs                                          | Important properties and related work first; remaining relationships under a clearly labeled related-records surface    |
| Relationships         | Rich record choices; filter picker traverses related-person attributes                 | Shared identities and related creation exist, but adding a contact opens a dialog and then a picker | Direct searchable relationship editor, marked existing membership, inline creation, consistent preview and navigation   |
| Search                | Records and contextual commands, keyboard hints, selected-result preview               | Indexed cross-object results, navigation and create commands                                        | Add recents, context actions and preview to the existing palette; keep one search index                                 |
| Collection actions    | Selecting a company reveals Add to list, Send email, Run workflow, and a deletion menu | Standard selected-record toolbar centers on deletion                                                | Deliberate model-backed actions for the current selection, with clear scope and outcomes                                |
| Filters and summaries | Related-attribute traversal and column calculation affordances                         | Current Companies filter picker offers direct properties; footer reports record counts              | First support one useful relationship predicate and authorized aggregate end to end                                     |
| Visual hierarchy      | Soft control surfaces, rich logos, colored categories, humanized values                | Dense small controls, blue record links, mostly monochrome example data, many hard borders          | More deliberate identity, semantic color, density and focus hierarchy through shared components                         |
| Navigation            | Personal work, favorites, records, lists, automation areas                             | Sidebar exposes most module objects directly                                                        | Curated module entry points and work queues; optional favorites/recents; all objects remain discoverable                |
| Creation              | Templates, Create more, keyboard submit; also a very long initial form                 | One shared form with relationship creation and draft protection                                     | Required and operationally important fields first, optional details progressively disclosed, consistent keyboard submit |

### Record workspaces are the first priority

Opening a company should preserve the originating view, filters, loaded window, scroll position, and keyboard focus. Closing returns to the exact place. Previous/next traverses that result order and fetches more only when needed. A copied record URL must still work without an originating collection. On a narrow screen, the same content should become a full-page workspace with an explicit return affordance.

Use one content component for both presentations. Do not build a separate miniature record application inside a modal, or an unlimited stack of nested record dialogs. Cross-record navigation should retain a clear return path.

The current company page makes Contacts, Primary contacts, Deals, Role assignments (owned), and Deals (owned) peers. These can represent valid distinct facts, but they are not equally important navigation destinations. Preserve the underlying distinctions; curate labels and placement around the user's work. Put technical identifiers and rarely used ownership relationships in secondary details. The developer model explorer remains the comprehensive schema surface.

Start with Overview, Related, and Activity as an initial design hypothesis, allowing a few domain-specific work tabs when justified. Do not force this exact set onto every custom workflow. The overview should show useful related summaries and next actions, not just a differently styled properties list.

### Make field and relationship interaction consistent

We already have shared object identity/preview rendering and typed editors. Consolidate their behavior before inventing another UI framework:

- A record looks recognizable in a table, reference field, picker, search result, and header.
- A field has one understandable edit, commit, cancel, pending, and failure behavior across surfaces.
- Relationship selection searches immediately, distinguishes already-linked records, and supports creation without losing the outer draft.
- Single references and many-valued relationships share visual language while retaining their different cardinality and write semantics.
- Clearing a pointer, unlinking an association, and deleting a record must remain distinct actions.
- Empty states guide the next useful action. Avoid filling every cell with equally prominent “Empty” text.

In the inspected Add Contact flow, the already-linked contact appeared as an ordinary candidate. Membership state should be visible, with server constraints remaining authoritative. Improve this at the relationship editor boundary rather than introducing per-object fixes.

### Add collection power through the existing model

Attio's related-field filtering is more valuable than many additional view layouts. A useful first slice is “companies with an open deal above a specified amount,” with a clearly defined currency condition. This needs a model-aware server predicate, authorization before filtering/aggregation, a typed API contract, and a usable filter control. It must not filter or total only the currently loaded browser rows.

Keep the initial implementation bounded: explicit supported relationship paths, operators, sort behavior, and query limits. Prove a concrete query before creating a general formula language, arbitrary join builder, or universal reporting engine.

Selection should enable useful work. Reuse the model's existing action identity and input contract, and let UI configuration choose eligible placements. Add selection-aware props only for a concrete batch operation. Do not turn every action into an automatically generated command, or pretend that an arbitrary action is safely batchable. Define whether an operation is atomic, per-record, or a queued job and expose partial failures appropriately.

Keep code-governed team views. Personal favorites, recent records, and display preferences can be ordinary preference data without becoming a runtime schema or page builder. A user should not need a code change to remember a favorite company.

### Improve visual quality through a few shared decisions

Place the selected view and its settings beside one another. Keep creation and domain actions in a stable action area, and filters/sort/search in a predictable secondary toolbar. Avoid making the same task discoverable only through different menus in different layouts.

Use calm, readable record titles; make navigation apparent on hover and focus without making every name bright blue. Use assets and consistent fallback marks. Give statuses intentional semantic color where it helps distinguish business state; do not copy a CRM's category palette indiscriminately.

Offer a comfortable table density alongside compact density. Use less permanent chrome, clear hover and focus states, and a consistent radius and surface hierarchy. Preserve obvious keyboard interaction and large enough touch controls. A horizontal table can remain a table on mobile; the record workspace and primary actions still need a mobile-appropriate hierarchy.

The narrow-screen Company OS record did not overflow the document at 390px, but its relationship tabs stretched far outside the initially visible tab strip. Responsive containment is not the same as good mobile discoverability.

## Architecture to preserve

Keep the current semantic model, TanStack Query cache, Router preloading, transactional writes, revision checks, and authorized event feed. This review found no evidence that replacing them with TanStack DB or a new sync store is required for the proposed interactions.

The missing abstraction is a small presentation contract for record composition, not another domain model. Extend existing object UI configuration to select important properties and relationship sections when that removes real duplication. Keep ordinary React components for custom sections and full-page replacements. Let the model govern data meaning and capabilities; let source-owned UI configuration govern their presentation.

Relevant implementation boundaries:

- `apps/company-os/src/ui/model/object-record-page.tsx`: current record assembly and automatically exposed relationship tabs.
- `apps/company-os/src/ui/model/module-ui.tsx`: existing typed field editors, actions, collection extensions, overview and page replacements.
- `apps/company-os/src/ui/model/model-pages.tsx`: default and custom page composition.
- `apps/company-os/src/ui/model/object-record-identity.tsx`: shared identity, link, and hover preview.
- `apps/company-os/src/ui/model/object-reference-select.tsx` and `object-relationship-form.tsx`: relationship selection and writes.
- `apps/company-os/src/ui/model/object-table/`: field interaction, keyboard navigation, filtering and selected-record controls.
- `apps/company-os/src/ui/application/command-palette.tsx`: existing record search and command surface.
- [Data access](../data.md), [search](../search.md), and [events](../events.md): current data and visibility contracts.

Do not add a parallel action registry, normalize all business data into component state, or make feature code declare invalidation dependencies. Bounded speculative feedback can be considered for simple field edits, but arbitrary actions must not invent successful business outcomes before confirmation.

## Recommended sequence

### 1. Finish the everyday record interaction loop

Deliver a context-preserving record workspace, curated record hierarchy, unified identity and field interactions, simpler relationship selection/creation, adjacent view controls, and useful recents/context commands. Add enough coherent synthetic data to exercise companies, people, deals, notes, and activity together. Avoid copying private Attio data into the demo.

Acceptance: open from a filtered, scrolled collection; navigate to a related person; edit a field; add a related record; return to the exact collection position. Repeat with keyboard and narrow-screen navigation. Fail a mutation and produce a revision conflict: preserve the draft, focus, and readable record. No page-specific object branches should be needed for the second object using this workspace.

### 2. Make collections useful for real operational work

Deliver one relationship filter/aggregate slice and one useful selection action, then expand from evidence. Add reproducible larger synthetic fixtures and profile cold load, cached navigation, long scrolling, field edits, and concurrent browser updates. Import validation and duplicate resolution are important follow-ups for adopting real customer data; do not squeeze a general import/merge platform into the first UX checkpoint.

Acceptance: totals and filters agree with authorized server results across all matching records; selected scope is explicit; a second user's update changes the relevant view without losing the first user's draft; cached navigation does not blank the screen. Set latency budgets against named datasets and network conditions, not subjective claims of being faster than Attio. Test at least a thousand records before using the demo as evidence of scale.

### 3. Prove one agentic operation inside the same workspace

Use engineering as a differentiated first operation: a customer ticket links to an issue and pull request; an agent investigates or addresses review feedback; tests and a human approval govern progression. Humans see what needs attention, the evidence behind a proposal, which actor changed a record, and whether external work succeeded or needs repair.

The app owns business state, policies, desired outcomes, and receipts. An execution adapter starts or resumes external agent work. Begin with one real provider and a deterministic test implementation; persist execution identity and idempotency so retries cannot duplicate side effects. Do not build a general controller platform before proving this operation.

A human-facing activity timeline should project meaningful authorized events from the journal, not expose raw payloads. Integrations, people, and agents should share the same visible operation history. Historical event visibility must continue to follow the journal's permission contract.

Acceptance: the operation advances through real governed actions; interrupted execution can resume or clearly request repair; consequential steps have appropriate approval; users can trace an outcome back to evidence and execution. A chat panel or an “AI” badge alone does not pass.

## What not to copy

Do not reproduce every Attio navigation category, runtime attribute editor, list abstraction, or page-builder mechanism. Its long create form and multiple navigation concepts also carry cognitive cost. Company OS can be more focused through business-specific source configuration, progressive forms, and fewer equally prominent destinations.

Do not claim AI as an exclusive distinction: Ask Attio, Workflows, and Sequences are visible in the reviewed product. The credible differentiation to prove is custom operations across business domains, customer-controlled rules and execution, and inspectable outcomes. Matching the everyday record loop is the prerequisite for that story to feel convincing.

## Implementation follow-up

The first workspace checkpoint now includes URL-addressable collection previews, cross-object
return navigation, previous/next within the loaded collection, shared full-page content, curated
or model-derived details, long-text reading sections, bounded related-record previews, a searchable
relationship selector, focused field editors, progressive create forms, direct relationship
selection/creation, consistent choice colors, and cache-backed recent-record suggestions.

Browser verification exercised Company, Contact, Issue, and Ticket workspaces; related-record
creation and unlinking; required-field errors and discard protection; and a two-client revision
conflict with a preserved draft. The narrow layout kept the document and record workspace within
390px. Temporary verification records were removed.

This narrows the navigation and composition gap; it does not establish overall superiority to
Attio. Attio still has a richer activity/work surface, contextual business commands, relationship
filtering, and collection-wide sequential navigation. Our focused field editor remains an explicit
form, not Attio-style inline autosave. Revision conflicts preserve drafts but do not yet offer a
field-by-field merge workflow. Performance at comparable data volumes remains unbenchmarked.

See [record workspaces](../record-workspaces.md) for the current authoring contract and boundaries.

## Record hierarchy correction

User review rejected hidden optional form fields, the sparse details rail, and the extra
Overview → Related → collection navigation. Standard forms now show all editable fields.
Record details are compact and visible; named relationship tabs open the real collection
with editing and creation controls. The preview-card component and its extra reads were removed.
Reverse relationship views use the declared writable side for linking, and new linked records
can initialize that relationship transactionally through the existing create contract.
