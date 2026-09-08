# @company/notes

Source-owned notes that attach to any record implementing `NoteSubject`. The package owns the Note
definition, its association, Markdown editor and reader, collection views, and seed content. It has
no dependency on Sales, Engineering, an application client, or a database connection.

## Compose

Add `@company/notes: workspace:*` to the app's dependencies and include the foundation-bound module:

```ts
import { NotesModule } from "@company/notes/model"
// Include NotesModule in defineModel({ modules: [...] }).
```

`defineNotesModule(root)` remains available for a standalone model with its own root and presentation.

Objects opt into attachment by implementing the exported `NoteSubject` interface from
`@company/notes/model`. The module owns both directions of that association. Standard CRUD,
relationship operations, permissions, and storage derive from the composed model.

At the app UI composition boundary, include `NotesUi` from `@company/notes/ui` in `composeModelUi`. Import `@company/notes/styles.css` after the design system stylesheet so Tailwind scans
the package's components. The app supplies records, author labels, navigation targets, form state,
and actions through `@company/runtime/ui/model/*` contracts.

`noteSeed(index, subject)` from `@company/notes/seeds` returns deterministic Markdown content.
The caller owns record IDs, audit actors, persistence, and links, allowing the same content to serve
small demos and performance datasets without choosing a database or mutating it at import time.

## Storage and ownership

The app compiles the installed model into its reviewed `schema.sql` and runs its migrations through
one Effect SQL migration ledger. Notes requires no handwritten storage schema, custom server binding,
or independent migration runner. The template can regenerate its initial baseline; customized apps
with durable data own subsequent migration changes.

This is a local pnpm package with explicit source exports. Customize it directly in this repository
or copy it and its declared dependencies into another compatible workspace. Packaging is a code
boundary, not a runtime installation lifecycle.

The central app's composition test installs Notes with Engineering and no Sales. Its database test
installs a Notes-only schema into isolated PostgreSQL, replays the migration, then creates, edits,
links, and deletes a note through the shared repository implementation.
