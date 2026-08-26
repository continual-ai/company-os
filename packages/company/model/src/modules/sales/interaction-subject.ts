import { defineLink } from "@company/runtime"

import { Interaction } from "./interaction"
import { Party } from "./party"

export const InteractionSubject = defineLink({
  id: "interactionSubject",
  name: "Interaction subject",
  description: "Connects an interaction to its company or contact subject.",
  forward: {
    from: Interaction,
    to: Party,
    key: "subject",
    cardinality: "one",
    label: "Subject",
    description: "The company or contact involved in the interaction.",
  },
  reverse: {
    from: Party,
    to: Interaction,
    key: "interactions",
    cardinality: "many",
    label: "Interactions",
    description: "Interactions involving this party.",
  },
})
