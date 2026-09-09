import type { RoleAssignment } from "#/runtime/access/model/index.ts"
import type { ObjectUi } from "#/runtime/ui/model/object-ui.ts"

export const roleAssignmentUi = {
  navigation: { hidden: true },
} satisfies ObjectUi<typeof RoleAssignment>
