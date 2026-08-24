import { defineRoot } from "@continual/runtime"

import { AuthorizationScope } from "#interfaces/authorization-scope"

export const Platform = defineRoot({
  id: "platform",
  name: "Platform",
  implements: [{ interface: AuthorizationScope }],
})
