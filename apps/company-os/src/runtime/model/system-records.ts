import { RecordId } from "#/runtime/model/index.ts"

/** Stable records owned by the application and ensured during migration. */
export const SYSTEM_SERVICE_ACCOUNT_ID = RecordId("serviceAccount")(
  "service_account_system"
)
export const ANONYMOUS_ACTOR_ID = RecordId("anonymousActor")("anonymous_actor")
