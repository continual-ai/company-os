import type { User } from "#/runtime/access/model/index.ts"
import type { ObjectUi } from "#/runtime/ui/model/object-ui.ts"

export const userUi = {
  navigation: { order: 10 },
} satisfies ObjectUi<typeof User>
