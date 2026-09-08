import type { ObjectUi } from "@company/ui/model/object-ui"
import { NotebookPenIcon } from "lucide-react"

import type { NoteObject } from "#/model.ts"
import { NoteEditor } from "#/note-editor.tsx"
import { NoteOverview, NoteSummary } from "#/note-summary.tsx"
import { noteViews } from "#/views.ts"

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

export const notesUi = { note: noteUi }
