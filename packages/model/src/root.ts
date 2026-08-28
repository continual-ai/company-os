import { defineRoot } from "@company/runtime"

import { AuthorizationScope } from "./modules/access/authorization-scope"

/** Structural singleton above every durable object in this model. */
export const Root = defineRoot({
  id: "root",
  name: "Root",
  implements: [{ interface: AuthorizationScope }],
})
