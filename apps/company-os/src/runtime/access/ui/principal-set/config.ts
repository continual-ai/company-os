import type { PrincipalSet } from "#/runtime/access/model/index.ts"
import type { ObjectUi } from "#/runtime/ui/model/object-ui.ts"

export const principalSetUi = {
  navigation: { hidden: true },
} satisfies ObjectUi<typeof PrincipalSet>
