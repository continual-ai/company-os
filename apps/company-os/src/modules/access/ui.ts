import { defineModuleUi } from "@/ui/model/module-ui"

import { anonymousActorUi } from "./anonymous-actor/ui/config"
import { groupMembershipUi } from "./group-membership/ui/config"
import { groupUi } from "./group/ui/config"
import { AccessModule } from "./model"
import { principalSetUi } from "./principal-set/ui/config"
import { roleAssignmentUi } from "./role-assignment/ui/config"
import { roleUi } from "./role/ui/config"
import { serviceAccountUi } from "./service-account/ui/config"
import { userUi } from "./user/ui/config"

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
