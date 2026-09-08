import { anonymousActorUi } from "#/modules/access/anonymous-actor/ui/config.ts"
import { groupMembershipUi } from "#/modules/access/group-membership/ui/config.ts"
import { groupUi } from "#/modules/access/group/ui/config.ts"
import { AccessModule } from "#/modules/access/model.ts"
import { principalSetUi } from "#/modules/access/principal-set/ui/config.ts"
import { roleAssignmentUi } from "#/modules/access/role-assignment/ui/config.ts"
import { roleUi } from "#/modules/access/role/ui/config.ts"
import { serviceAccountUi } from "#/modules/access/service-account/ui/config.ts"
import { userUi } from "#/modules/access/user/ui/config.ts"
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
