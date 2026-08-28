import { defineInterface } from "@company/runtime"

export const Actor = defineInterface({
  id: "actor",
  name: "Actor",
  pluralName: "Actors",
  description:
    "A durable object that may be recorded as performing an operation.",
})
