import { defineRoot } from "@company/runtime"

import { AuthorizationScope } from "#interfaces/authorization-scope"

export const Platform = defineRoot({
  id: "platform",
  name: "Platform",
  implements: [{ interface: AuthorizationScope }],
})
