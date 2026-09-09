import { defineInterface } from "#/runtime/model/definition/interface.ts"

/** Records where roles can be granted and inherited by the records they own. */
export const AuthorizationScope = defineInterface({
  id: "authorizationScope",
  name: "Authorization scope",
  pluralName: "Authorization scopes",
  description:
    "A resource where roles can be granted and inherited by records it owns.",
})
