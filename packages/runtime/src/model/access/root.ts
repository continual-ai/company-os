import { AuthorizationScope } from "#/model/access/interfaces/authorization-scope.ts"
import { defineRoot } from "#/model/index.ts"

/** Structural singleton above every durable object in this model. */
export const Root = defineRoot({
  id: "root",
  name: "Root",
  implements: [{ interface: AuthorizationScope }],
})
