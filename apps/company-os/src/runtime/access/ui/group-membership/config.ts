import type { GroupMembership } from "#/runtime/access/model/index.ts"
import type { ObjectUi } from "#/runtime/ui/model/object-ui.ts"

export const groupMembershipUi = {
  navigation: { hidden: true },
} satisfies ObjectUi<typeof GroupMembership>
