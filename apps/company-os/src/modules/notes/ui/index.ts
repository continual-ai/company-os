import { NotebookPenIcon } from "lucide-react"

import { NotesModule, NoteSubjects } from "#/modules/notes/model/index.ts"
import type { Note } from "#/modules/notes/model/index.ts"
import { NoteFeed } from "#/modules/notes/ui/note-feed.tsx"
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
  record: {
    summaryComponent: NoteSummary,
    overviewComponent: NoteOverview,
    title: () => "Note",
  },
  collection: { views: noteViews },
} satisfies ObjectUi<typeof Note>

export const NotesUi = defineModuleUi(NotesModule, { note: noteUi }, [
  { link: NoteSubjects, side: "reverse", component: NoteFeed },
])
