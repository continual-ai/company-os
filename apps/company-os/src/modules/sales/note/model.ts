import { defineObject, schema } from "@company/runtime"

import { Root } from "#root"

export const Note = defineObject({
  id: "note",
  collection: "notes",
  name: "Note",
  parent: Root,
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
