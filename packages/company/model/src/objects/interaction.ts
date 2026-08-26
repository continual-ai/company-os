import { defineObject, schema } from "@company/runtime"

import { Root } from "#root"

export const Interaction = defineObject({
  id: "interaction",
  collection: "interactions",
  name: "Interaction",
  parent: Root,
  pluralName: "Interactions",
  description: "A call, email, meeting, or note involving a business party.",
  properties: {
    kind: schema.select({
      label: "Kind",
      default: "note",
      options: [
        { value: "note", label: "Note" },
        { value: "email", label: "Email" },
        { value: "call", label: "Call" },
        { value: "meeting", label: "Meeting" },
      ],
    }),
    occurredAt: schema.timestamp({ label: "Occurred at" }),
    summary: schema.string({ label: "Summary", minLength: 1, maxLength: 500 }),
    details: schema.string({ label: "Details", nullable: true }),
  },
  display: {
    icon: "interaction",
    status: "kind",
    subtitle: "occurredAt",
    title: "summary",
  },
})
