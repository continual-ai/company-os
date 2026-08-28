import { defineLink } from "@company/runtime"

import { Note } from "./note"
import { NoteSubject } from "./note-subject"

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
    description: "The business records this note concerns.",
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
