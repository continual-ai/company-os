import { AccessModule } from "#/runtime/access/model/index.ts"
import { anonymousActorUi } from "#/runtime/access/ui/anonymous-actor/config.ts"
import { groupMembershipUi } from "#/runtime/access/ui/group-membership/config.ts"
import { groupUi } from "#/runtime/access/ui/group/config.ts"
import { principalSetUi } from "#/runtime/access/ui/principal-set/config.ts"
import { roleAssignmentUi } from "#/runtime/access/ui/role-assignment/config.ts"
import { roleUi } from "#/runtime/access/ui/role/config.ts"
import { serviceAccountUi } from "#/runtime/access/ui/service-account/config.ts"
import { userUi } from "#/runtime/access/ui/user/config.ts"
import { defineModuleUi } from "#/runtime/ui/model/module-ui.tsx"

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
