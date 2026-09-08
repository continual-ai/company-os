import { AccessModule } from "#/model/access/model.ts"
import { anonymousActorUi } from "#/ui/access/anonymous-actor/ui/config.ts"
import { groupMembershipUi } from "#/ui/access/group-membership/ui/config.ts"
import { groupUi } from "#/ui/access/group/ui/config.ts"
import { principalSetUi } from "#/ui/access/principal-set/ui/config.ts"
import { roleAssignmentUi } from "#/ui/access/role-assignment/ui/config.ts"
import { roleUi } from "#/ui/access/role/ui/config.ts"
import { serviceAccountUi } from "#/ui/access/service-account/ui/config.ts"
import { userUi } from "#/ui/access/user/ui/config.ts"
import { defineModuleUi } from "#/ui/model/module-ui.tsx"

/** Access management lives in Settings; audit-only actors have no main navigation entry. */
export const AccessUi = defineModuleUi(AccessModule, {
  anonymousActor: anonymousActorUi,
  group: groupUi,
  groupMembership: groupMembershipUi,
  principalSet: principalSetUi,
  role: roleUi,
  roleAssignment: roleAssignmentUi,
  serviceAccount: serviceAccountUi,
  user: userUi,
})
