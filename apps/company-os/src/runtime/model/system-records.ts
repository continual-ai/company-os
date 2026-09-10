import { RecordId } from "#/runtime/model/index.ts"

/** Stable records owned by the application and ensured during migration. */
// These persisted identifiers predate the Root terminology. They remain
// stable application ABI; code derives semantics from their branded types.
export const ROOT_ID = RecordId("root")("platform_system")
export const SYSTEM_SERVICE_ACCOUNT_ID = RecordId("serviceAccount")(
  "service_account_system"
)
export const ANONYMOUS_ACTOR_ID = RecordId("anonymousActor")("anonymous_actor")
