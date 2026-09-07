import { defineInterface } from "@company/runtime"

export const AuthorizationScope = defineInterface({
  id: "authorizationScope",
  name: "Authorization scope",
  pluralName: "Authorization scopes",
  description:
    "A resource where roles can be granted and inherited by records it owns.",
})
