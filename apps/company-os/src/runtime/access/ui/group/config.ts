import type { Group } from "#/runtime/access/model/index.ts"
import { GroupToolbar } from "#/runtime/access/ui/group/toolbar.tsx"
import type { ObjectUi } from "#/runtime/ui/model/object-ui.ts"
export const groupUi = {
  navigation: { hidden: true },
  collection: { toolbarComponent: GroupToolbar },
} satisfies ObjectUi<typeof Group>
