import type { LineItem } from "#/modules/sales/model/line-item.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

export const lineItemUi = { navigation: { hidden: true } } satisfies ObjectUi<
  typeof LineItem
>
