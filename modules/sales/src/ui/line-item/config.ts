import type { ObjectUi } from "@company/runtime/ui/module"

import type { LineItem } from "#/model/line-item.ts"

export const lineItemUi = { navigation: { hidden: true } } satisfies ObjectUi<
  typeof LineItem
>
