import { NoteSubject } from "#/modules/notes/model/note-subject.ts"
import {
  defineLink,
  defineModule,
  defineObject,
  schema,
} from "#/runtime/model/index.ts"

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
  from: Note,
  to: NoteSubject,
  forward: {
    key: "subjects",
    min: 0,
    label: "Subjects",
    description: "Link the people, companies, or work this note is about.",
  },
  reverse: {
    key: "notes",
    min: 0,
    label: "Notes",
    description: "Notes attached to this business record.",
  },
})

export const NotesModule = defineModule({
  maturity: "alpha",
  origin: {
    name: "Company OS",
    url: "https://github.com/continual-ai/company-os",
  },
  description: "Attach shared notes and activity to business records.",
  id: "notes",
  name: "Notes",
  interfaces: [NoteSubject],
  objects: [Note],
  links: [NoteSubjects],
})

export { NoteSubject } from "#/modules/notes/model/note-subject.ts"
