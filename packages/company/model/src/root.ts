import { defineRoot } from "@company/runtime"

import { AuthorizationScope } from "#interfaces/authorization-scope"

/** Structural singleton above every durable object in this model. */
export const Root = defineRoot({
  id: "root",
  name: "Root",
  implements: [{ interface: AuthorizationScope }],
})
