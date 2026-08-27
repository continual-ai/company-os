import { defineLink } from "@company/runtime"

import { Interaction } from "./interaction"
import { Party } from "./party"

export const InteractionRegarding = defineLink({
  id: "interactionRegarding",
  name: "Interaction regarding",
  writeFrom: false,
  description: "Connects an interaction to the primary party it concerns.",
  forward: {
    from: Interaction,
    to: Party,
    key: "regarding",
    cardinality: "one",
    label: "Regarding",
    description: "The primary company or contact this interaction concerns.",
  },
  reverse: {
    from: Party,
    to: Interaction,
    key: "interactions",
    cardinality: "many",
    label: "Interactions",
    description: "Interactions primarily concerning this party.",
  },
})
