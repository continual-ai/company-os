import type { Role } from "#/model/access/model.ts"
import { RoleToolbar } from "#/ui/access/role/ui/toolbar.tsx"
import type { ObjectUi } from "#/ui/model/object-ui.ts"
export const roleUi = {
  navigation: { hidden: true },
  collection: { toolbarComponent: RoleToolbar },
} satisfies ObjectUi<typeof Role>
