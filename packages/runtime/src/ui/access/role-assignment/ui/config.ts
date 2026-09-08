import type { RoleAssignment } from "#/model/access/model.ts"
import type { ObjectUi } from "#/ui/model/object-ui.ts"

export const roleAssignmentUi = {
  navigation: { hidden: true },
} satisfies ObjectUi<typeof RoleAssignment>
