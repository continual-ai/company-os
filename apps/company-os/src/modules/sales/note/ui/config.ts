import type { Model } from "company-os/model"
import { NotebookPenIcon } from "lucide-react"

import type { ObjectUi } from "@/ui/model/module-ui"

import { NoteEditor } from "./note-editor"
import { NoteOverview, NoteSummary } from "./note-summary"
import { noteViews } from "./views"

export const noteUi = {
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
} satisfies ObjectUi<typeof Model.objects.note>
