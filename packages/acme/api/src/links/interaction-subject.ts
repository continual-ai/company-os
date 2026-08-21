import { defineLink } from "@continual/runtime"

import { Party } from "#interfaces/party"
import { Interaction } from "#objects/interaction"

export const InteractionSubject = defineLink({
  id: "interactionSubject",
  name: "Interaction subject",
  description: "Connects an interaction to its company or contact subject.",
  from: {
    type: Interaction,
    name: "subject",
    cardinality: "one",
  },
  to: {
    type: Party,
    name: "interactions",
    cardinality: "many",
  },
})
