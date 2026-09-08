import type { User } from "#/model/access/model.ts"
import type { ObjectUi } from "#/ui/model/object-ui.ts"

export const userUi = { navigation: { hidden: true } } satisfies ObjectUi<
  typeof User
>
