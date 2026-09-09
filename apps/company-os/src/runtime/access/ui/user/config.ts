import type { User } from "#/runtime/access/model/index.ts"
import type { ObjectUi } from "#/runtime/ui/model/object-ui.ts"

export const userUi = {
  navigation: { hidden: true, path: "/settings/users" },
} satisfies ObjectUi<typeof User>
