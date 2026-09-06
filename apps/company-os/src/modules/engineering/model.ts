import { defineModule } from "@company/runtime"

import { Issue } from "./issue/model"
export const EngineeringModule = defineModule({
  id: "engineering",
  name: "Engineering",
  interfaces: [],
  links: [],
  objects: [Issue],
})
