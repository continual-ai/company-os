import type { GroupMembership } from "#/runtime/access/model/index.ts"
import type { ObjectUi } from "#/runtime/ui/model/object-ui.ts"

export const groupMembershipUi = {
  navigation: { hidden: true, path: "/settings/group-memberships" },
} satisfies ObjectUi<typeof GroupMembership>
