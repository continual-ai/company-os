import type { ObjectUi } from "@company/ui/model/object-ui"

import type { Model } from "#/app.model.ts"
import { GroupToolbar } from "#/modules/access/group/ui/toolbar.tsx"
export const groupUi = {
  navigation: { hidden: true },
  collection: { toolbarComponent: GroupToolbar },
} satisfies ObjectUi<typeof Model.objects.group>
