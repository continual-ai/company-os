import { Actor } from "#/model/access/interfaces/actor.ts"
import { Root } from "#/model/access/root.ts"
import { defineObject, schema } from "#/model/index.ts"

export const AnonymousActor = defineObject({
  id: "anonymousActor",
  collection: "anonymousActors",
  name: "Anonymous actor",
  parent: Root,
  pluralName: "Anonymous actors",
  description: "Identifies activity from visitors who are not signed in.",
  actions: { create: false, delete: false, update: false },
  implements: [{ interface: Actor }],
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
  },
  display: { icon: "person", title: "name" },
})
