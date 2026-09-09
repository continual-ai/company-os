import { AuthorizationScope } from "#/runtime/access/model/interfaces/authorization-scope.ts"
import { defineRoot } from "#/runtime/model/index.ts"

/** Structural singleton above every durable object in this model. */
export const Root = defineRoot({
  id: "root",
  name: "Root",
  implements: [{ interface: AuthorizationScope }],
})
