import { defineConnector } from "#/runtime/model/index.ts"

export const GitHub = defineConnector({
  id: "github",
  name: "GitHub",
  description:
    "Enter a GitHub organization or username, such as continual-ai or tristanz, and a fine-grained personal access token with Metadata, Issues, and Pull requests read access. Repositories owned by that account and accessible to the token, along with their issues and pull requests, sync automatically.",
  authentication: "token",
})
