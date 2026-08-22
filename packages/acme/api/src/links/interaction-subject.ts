import { defineLink } from "@continual/runtime"

import { Party } from "#interfaces/party"
import { Interaction } from "#objects/interaction"

export const InteractionSubject = defineLink({
  id: "interactionSubject",
  name: "Interaction subject",
  description: "Connects an interaction to its company or contact subject.",
  from: {
    type: Interaction,
    key: "subject",
    cardinality: "one",
    label: "Subject",
    description: "The company or contact involved in the interaction.",
  },
  to: {
    type: Party,
    key: "interactions",
    cardinality: "many",
    label: "Interactions",
    description: "Interactions involving this party.",
  },
})
