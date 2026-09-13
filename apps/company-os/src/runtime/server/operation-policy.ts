import { Effect } from "effect"

import type { ObjectType } from "#/runtime/model/definition/object.ts"
import { SYSTEM_SERVICE_ACCOUNT_ID } from "#/runtime/model/system-records.ts"
import { SystemRecordReadOnly } from "#/runtime/server/errors.ts"
import { currentActorId } from "#/runtime/server/invocation-context.ts"

/** System records remain immutable through public writes, including batch deletion. */
export const assertRecordWritable = Effect.fn("@company/assertRecordWritable")(
  function* (
    object: ObjectType,
    record: { readonly id: string; readonly systemManaged: boolean }
  ) {
    if (
      record.systemManaged &&
      (yield* currentActorId) !== SYSTEM_SERVICE_ACCOUNT_ID
    )
      return yield* Effect.fail(
        new SystemRecordReadOnly({ objectType: object.id, recordId: record.id })
      )
    return undefined
  }
)
