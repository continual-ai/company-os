import type { ServiceAccount } from "#/runtime/access/model/index.ts"
import type { ObjectUi } from "#/runtime/ui/model/object-ui.ts"

export const serviceAccountUi = {
  navigation: { hidden: true },
} satisfies ObjectUi<typeof ServiceAccount>
