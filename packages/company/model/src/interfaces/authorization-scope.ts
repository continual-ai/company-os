import { defineInterface } from "@company/runtime"

export const AuthorizationScope = defineInterface({
  id: "authorizationScope",
  name: "Authorization scope",
  pluralName: "Authorization scopes",
  description:
    "An object on which roles may be assigned and inherited by descendants.",
})
