import type { ServiceAccount } from "#/model/access/model.ts"
import type { ObjectUi } from "#/ui/model/object-ui.ts"

export const serviceAccountUi = {
  navigation: { hidden: true },
} satisfies ObjectUi<typeof ServiceAccount>
