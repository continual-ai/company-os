import { defineLink } from "@company/runtime"

import { NoteSubject } from "#modules/sales/interfaces/note-subject"
import { Note } from "#modules/sales/note/model"

export const NoteSubjects = defineLink({
  id: "noteSubjects",
  name: "Note subjects",
  writeFrom: "subjects",
  description: "Attaches a note to the business records it concerns.",
  forward: {
    from: Note,
    to: NoteSubject,
    key: "subjects",
    cardinality: "many",
    label: "Subjects",
    description: "Link the people, companies, or work this note is about.",
  },
  reverse: {
    from: NoteSubject,
    to: Note,
    key: "notes",
    cardinality: "many",
    label: "Notes",
    description: "Notes attached to this business record.",
  },
})
