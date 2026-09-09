import { NoteSubject } from "#/modules/notes/model/note-subject.ts"
import { Root } from "#/runtime/access/model/index.ts"
import {
  defineObject,
  defineModule,
  defineLink,
  schema,
  type RootType,
} from "#/runtime/model/index.ts"

export function defineNotesModule<const R extends RootType>(root: R) {
  const Note = defineObject({
    id: "note",
    collection: "notes",
    name: "Note",
    parent: root,
    pluralName: "Notes",
    description: "Notes on conversations, decisions, or next steps.",
    properties: {
      content: schema.string({
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

  const NoteSubjects = defineLink({
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

  return defineModule({
    id: "notes",
    name: "Notes",
    interfaces: [NoteSubject],
    objects: [Note],
    links: [NoteSubjects],
  })
}

export const NotesModule = defineNotesModule(Root)
export const Note = NotesModule.objects[0]
export type NoteObject = ReturnType<typeof defineNotesModule>["objects"][0]

export { NoteSubject } from "#/modules/notes/model/note-subject.ts"
