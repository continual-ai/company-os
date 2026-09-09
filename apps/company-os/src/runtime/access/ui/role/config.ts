import type { Role } from "#/runtime/access/model/index.ts"
import { RoleToolbar } from "#/runtime/access/ui/role/toolbar.tsx"
import type { ObjectUi } from "#/runtime/ui/model/object-ui.ts"
export const roleUi = {
  navigation: { hidden: true },
  collection: { toolbarComponent: RoleToolbar },
} satisfies ObjectUi<typeof Role>
