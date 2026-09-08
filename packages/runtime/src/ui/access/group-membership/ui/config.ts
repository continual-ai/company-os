import type { GroupMembership } from "#/model/access/model.ts"
import type { ObjectUi } from "#/ui/model/object-ui.ts"

export const groupMembershipUi = {
  navigation: { hidden: true },
} satisfies ObjectUi<typeof GroupMembership>
