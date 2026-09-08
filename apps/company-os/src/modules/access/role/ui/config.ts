import type { ObjectUi } from "@company/ui/model/object-ui"

import type { Model } from "#/app.model.ts"
import { RoleToolbar } from "#/modules/access/role/ui/toolbar.tsx"
export const roleUi = {
  navigation: { hidden: true },
  collection: { toolbarComponent: RoleToolbar },
} satisfies ObjectUi<typeof Model.objects.role>
