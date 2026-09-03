import { RecordId } from "@company/runtime"

/** Stable records owned by the application and ensured during migration. */
// These persisted identifiers predate the Root terminology. They remain
// stable application ABI; code derives semantics from their branded types.
export const ROOT_ID = RecordId("root")("platform_system")
export const SYSTEM_SERVICE_ACCOUNT_ID = RecordId("serviceAccount")(
  "service_account_system"
)
export const ANONYMOUS_ACTOR_ID = RecordId("anonymousActor")("anonymous_actor")
export const ALL_CALLERS_PRINCIPAL_SET_ID = RecordId("principalSet")(
  "principal_set_all_callers"
)
export const ALL_AUTHENTICATED_CALLERS_PRINCIPAL_SET_ID = RecordId(
  "principalSet"
)("principal_set_all_authenticated_callers")
export const ADMINISTRATOR_ROLE_ID = RecordId("role")("role_platform_admin")
export const OPERATOR_ROLE_ID = RecordId("role")("role_platform_operator")
export const SYSTEM_ROLE_ASSIGNMENT_ID = RecordId("roleAssignment")(
  "role_assignment_system_platform_admin"
)
