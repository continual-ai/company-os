import { NotebookPenIcon } from "lucide-react"

import { NotesModule } from "#/modules/notes/model/index.ts"
import type { Note } from "#/modules/notes/model/index.ts"
import { NoteEditor } from "#/modules/notes/ui/note-editor.tsx"
import { NoteOverview, NoteSummary } from "#/modules/notes/ui/note-summary.tsx"
import { noteViews } from "#/modules/notes/ui/views.ts"
import { defineModuleUi } from "#/runtime/ui/module.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

const noteUi = {
  navigation: {
    order: 4,
    icon: NotebookPenIcon,
    description: "Conversation notes, decisions, and follow-ups.",
  },
  fieldEditors: { content: NoteEditor },
  record: {
    summaryComponent: NoteSummary,
    overviewComponent: NoteOverview,
    title: () => "Note",
  },
  collection: { views: noteViews },
} satisfies ObjectUi<typeof Note>

export const NotesUi = defineModuleUi(NotesModule, { note: noteUi })
