import { Data, Effect } from "effect"

import {
  ROOT_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
} from "#/runtime/model/system-records.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { insertValues, assignments } from "#/runtime/server/storage/index.ts"
import {
  conflictColumns,
  projection,
  type SelectionRow,
  inValues,
} from "#/runtime/server/storage/index.ts"

class SystemActorBootstrapConflict extends Data.TaggedError(
  "SystemActorBootstrapConflict"
)<{ readonly recordId: string }> {}

function objectRow(input: {
  readonly id: string
  readonly objectType: string
  readonly parentId: string | null
}) {
  return {
    ...input,
    metadata: {},
    createdById: SYSTEM_SERVICE_ACCOUNT_ID,
    systemManaged: true,
    updatedById: SYSTEM_SERVICE_ACCOUNT_ID,
  }
}

/** Establishes only the cyclic root and system identity required by seeds. */
export const bootstrapSystemActor = Effect.fn("@company/bootstrapSystemActor")(
  function* () {
    const { storage } = yield* ModelContext
    const { objects, roots } = storage.core
    const { actor: actors, identity: identities } = storage.interfaces
    if (!actors || !identities)
      return yield* Effect.die(
        "Access interfaces are required for system bootstrap."
      )
    const database = yield* Database
    const sql = database.sql
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        const root = objectRow({
          id: ROOT_ID,
          objectType: "root",
          parentId: null,
        })
        yield* sql`insert into ${objects} ${insertValues(sql, objects, root)}
          on conflict (${conflictColumns(sql, objects.columns.id)})
          do update set ${assignments(sql, objects, {
            etag: sql`(${objects.columns.etag}::numeric + 1)::text`,
            systemManaged: true,
            updatedAt: sql`now()`,
            updatedById: SYSTEM_SERVICE_ACCOUNT_ID,
          })}`
        yield* sql`insert into ${roots} ${insertValues(sql, roots, { id: ROOT_ID })}
          on conflict do nothing`

        const systemAccount = objectRow({
          id: SYSTEM_SERVICE_ACCOUNT_ID,
          objectType: "serviceAccount",
          parentId: ROOT_ID,
        })
        yield* sql`insert into ${objects} ${insertValues(sql, objects, systemAccount)}
          on conflict (${conflictColumns(sql, objects.columns.id)})
          do update set ${assignments(sql, objects, {
            etag: sql`(${objects.columns.etag}::numeric + 1)::text`,
            systemManaged: true,
            updatedAt: sql`now()`,
            updatedById: SYSTEM_SERVICE_ACCOUNT_ID,
          })}`
        yield* sql`insert into ${actors} ${insertValues(sql, actors, { id: SYSTEM_SERVICE_ACCOUNT_ID })}
          on conflict do nothing`
        yield* sql`insert into ${identities} ${insertValues(sql, identities, { id: SYSTEM_SERVICE_ACCOUNT_ID })}
          on conflict do nothing`

        const expectedObjects = [
          {
            id: ROOT_ID,
            objectType: "root",
            parentId: null,
          },
          {
            id: SYSTEM_SERVICE_ACCOUNT_ID,
            objectType: "serviceAccount",
            parentId: ROOT_ID,
          },
        ] as const
        const storedObjectsFields = {
          id: objects.columns.id,
          objectType: objects.columns.objectType,
          parentId: objects.columns.parentId,
        }
        const storedObjects = yield* sql<
          SelectionRow<typeof storedObjectsFields>
        >`select ${projection(storedObjectsFields)}
          from ${objects}
          where ${inValues(
            sql,
            objects.columns.id,
            expectedObjects.map(({ id }) => id)
          )}`
        const storedById = new Map(
          storedObjects.map((record) => [record.id, record])
        )
        for (const expected of expectedObjects) {
          const stored = storedById.get(expected.id)
          if (
            stored === undefined ||
            stored.objectType !== expected.objectType ||
            stored.parentId !== expected.parentId
          ) {
            return yield* Effect.fail(
              new SystemActorBootstrapConflict({ recordId: expected.id })
            )
          }
        }
        return undefined
      })
    )
  }
)
