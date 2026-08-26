import { defineObject, schema } from "@company/runtime"

import { Actor } from "#interfaces/actor"
import { Platform } from "#platform"

export const AnonymousActor = defineObject({
  id: "anonymousActor",
  collection: "anonymousActors",
  name: "Anonymous actor",
  parent: Platform,
  pluralName: "Anonymous actors",
  description:
    "The system-managed audit actor used when a request has no authenticated identity.",
  actions: { create: false, delete: false, update: false },
  implements: [{ interface: Actor }],
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
  },
  display: { icon: "person", title: "name" },
})
