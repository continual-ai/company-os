import { Data, Effect } from "effect"

import { SYSTEM_SERVICE_ACCOUNT_ID } from "#/runtime/model/system-records.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import {
  assignments,
  conflictColumns,
  insertValues,
} from "#/runtime/server/storage/index.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

class SystemActorBootstrapConflict extends Data.TaggedError(
  "SystemActorBootstrapConflict"
)<{ readonly recordId: string }> {}

/** Establishes the self-attributed system identity required by seeds. */
export const bootstrapSystemActor = Effect.fn("@company/bootstrapSystemActor")(
  function* () {
    const { storage } = yield* ModelContext
    const { objects } = storage.core
    const { actor: actors, identity: identities } = storage.interfaces
    if (!actors || !identities)
      return yield* Effect.die(
        "Access interfaces are required for system bootstrap."
      )
    const database = yield* SqlDatabase
    const sql = database.sql
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        const systemAccount = {
          id: SYSTEM_SERVICE_ACCOUNT_ID,
          objectType: "serviceAccount",
          metadata: {},
          createdById: SYSTEM_SERVICE_ACCOUNT_ID,
          systemManaged: true,
          updatedById: SYSTEM_SERVICE_ACCOUNT_ID,
        }
        const [stored] = yield* sql<{
          objectType: string
        }>`insert into ${objects} ${insertValues(sql, objects, systemAccount)}
          on conflict (${conflictColumns(sql, objects.columns.id)})
          do update set ${assignments(sql, objects, {
            etag: sql`(${objects.columns.etag}::numeric + 1)::text`,
            systemManaged: true,
            updatedAt: sql`now()`,
            updatedById: SYSTEM_SERVICE_ACCOUNT_ID,
          })}
          returning ${objects.columns.objectType} as "objectType"`
        if (stored?.objectType !== "serviceAccount")
          return yield* Effect.fail(
            new SystemActorBootstrapConflict({
              recordId: SYSTEM_SERVICE_ACCOUNT_ID,
            })
          )
        yield* sql`insert into ${actors} ${insertValues(sql, actors, { id: SYSTEM_SERVICE_ACCOUNT_ID })}
          on conflict do nothing`
        yield* sql`insert into ${identities} ${insertValues(sql, identities, { id: SYSTEM_SERVICE_ACCOUNT_ID })}
          on conflict do nothing`

        return undefined
      })
    )
  }
)
