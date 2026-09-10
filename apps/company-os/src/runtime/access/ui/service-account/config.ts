import { BotIcon } from "lucide-react"

import type { ServiceAccount } from "#/runtime/access/model/index.ts"
import type { ObjectUi } from "#/runtime/ui/model/object-ui.ts"

export const serviceAccountUi = {
  navigation: { order: 20, icon: BotIcon },
} satisfies ObjectUi<typeof ServiceAccount>
