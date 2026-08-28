import { defineObject, schema } from "@company/runtime"

import { Root } from "#root"

export const Note = defineObject({
  id: "note",
  collection: "notes",
  name: "Note",
  parent: Root,
  pluralName: "Notes",
  description: "A durable note attached to one or more business records.",
  properties: {
    content: schema.string({
      label: "Content",
      minLength: 1,
      maxLength: 10_000,
    }),
  },
  display: {
    icon: "note",
    title: "content",
  },
})
