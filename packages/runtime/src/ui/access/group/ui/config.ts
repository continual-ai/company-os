import type { Group } from "#/model/access/model.ts"
import { GroupToolbar } from "#/ui/access/group/ui/toolbar.tsx"
import type { ObjectUi } from "#/ui/model/object-ui.ts"
export const groupUi = {
  navigation: { hidden: true },
  collection: { toolbarComponent: GroupToolbar },
} satisfies ObjectUi<typeof Group>
