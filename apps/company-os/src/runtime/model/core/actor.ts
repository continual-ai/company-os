import { defineInterface } from "#/runtime/model/definition/interface.ts"
import type { RecordId } from "#/runtime/model/definition/schema.ts"

/** Interface implemented by every record allowed in audit actor fields. */
export const Actor = defineInterface({
  id: "actor",
  name: "Actor",
  pluralName: "Actors",
  description:
    "Who performed an action, such as a user, agent, or anonymous visitor.",
})

/**
 * Record ID of a kernel Actor implementer. The union is fixed because audit
 * columns, authentication, and system records depend on exactly these objects.
 */
export type ActorId =
  | RecordId<"user">
  | RecordId<"serviceAccount">
  | RecordId<"anonymousActor">
