import { defineModule } from "@company/runtime"

import { Campaign } from "./campaign/model"
import { Content } from "./content/model"
import { Enrollment } from "./enrollment/model"
import { Outreach } from "./outreach/model"

export const MarketingModule = defineModule({
  id: "marketing",
  name: "Marketing",
  interfaces: [],
  links: [],
  objects: [Campaign, Content, Enrollment, Outreach],
})
