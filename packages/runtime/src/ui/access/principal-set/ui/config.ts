import type { PrincipalSet } from "#/model/access/model.ts"
import type { ObjectUi } from "#/ui/model/object-ui.ts"

export const principalSetUi = {
  navigation: { hidden: true },
} satisfies ObjectUi<typeof PrincipalSet>
