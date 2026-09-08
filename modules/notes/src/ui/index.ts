import { defineModuleUi } from "@company/runtime/ui/module"
import type { ObjectUi } from "@company/runtime/ui/module"
import { NotebookPenIcon } from "lucide-react"

import { NotesModule } from "#/model/index.ts"
import type { NoteObject } from "#/model/index.ts"
import { NoteEditor } from "#/ui/note-editor.tsx"
import { NoteOverview, NoteSummary } from "#/ui/note-summary.tsx"
import { noteViews } from "#/ui/views.ts"

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
} satisfies ObjectUi<NoteObject>

export const NotesUi = defineModuleUi(NotesModule, { note: noteUi })
