import { NotebookPenIcon } from "lucide-react"

import { type Note } from "#/runtime/platform/model/note.ts"
import {
  NoteOverview,
  NoteSummary,
} from "#/runtime/platform/ui/note/note-summary.tsx"
import { noteViews } from "#/runtime/platform/ui/note/views.ts"
import { type ObjectUi } from "#/runtime/ui/module.ts"

export const noteUi = {
  navigation: {
    order: 4,
    icon: NotebookPenIcon,
    description: "Conversation notes, decisions, and follow-ups.",
  },
  record: {
    summaryComponent: NoteSummary,
    overviewComponent: NoteOverview,
    title: () => "Note",
  },
  collection: { views: noteViews },
} satisfies ObjectUi<typeof Note>
