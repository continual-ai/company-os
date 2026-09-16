import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"

export const Note = defineObject({
  id: "note",
  collection: "notes",
  name: "Note",
  pluralName: "Notes",
  description: "Notes on conversations, decisions, or next steps.",
  properties: {
    content: schema.markdown({
      label: "Content",
      minLength: 1,
      maxLength: 10_000,
    }),
  },
  search: { fields: ["content"] },
  display: {
    icon: "note",
    title: "content",
  },
})

export const NoteSubjects = defineLink({
  id: "noteSubjects",
  name: "Note subjects",
  description: "Attaches a note to the business records it concerns.",
  from: {
    object: Note,
    key: "subjects",
    min: 0,
    label: "Subjects",
    description: "Link the people, accounts, or work this note is about.",
  },
  to: {
    object: NoteSubject,
    key: "notes",
    min: 0,
    label: "Notes",
    description: "Notes attached to this business record.",
  },
})
