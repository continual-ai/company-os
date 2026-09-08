import { defineInterface } from "#/model/index.ts"

export const Actor = defineInterface({
  id: "actor",
  name: "Actor",
  pluralName: "Actors",
  description:
    "Who performed an action, such as a user, agent, or anonymous visitor.",
})
