import type { Model } from "@company/model"
import { inArray, sql } from "drizzle-orm"
import { Data, Effect } from "effect"

import { Database } from "@/server/database/database"
import {
  actors,
  authorizationScopes,
  identities,
  objects,
  platforms,
} from "@/server/database/schema"
import { PLATFORM_ID, SYSTEM_SERVICE_ACCOUNT_ID } from "@/system-records"

class SystemActorBootstrapConflict extends Data.TaggedError(
  "SystemActorBootstrapConflict"
)<{ readonly recordId: string }> {}

function objectRow(input: {
  readonly ancestorIds: Array<string>
  readonly id: string
  readonly objectType: (typeof Model.root)["id"] | keyof typeof Model.objects
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
    const database = yield* Database
    yield* database.transaction((transaction) =>
      Effect.gen(function* () {
        const platform = objectRow({
          ancestorIds: [],
          id: PLATFORM_ID,
          objectType: "platform",
          parentId: null,
        })
        yield* transaction
          .insert(objects)
          .values(platform)
          .onConflictDoUpdate({
            target: objects.id,
            set: {
              etag: sql`gen_random_uuid()::text`,
              systemManaged: true,
              updatedAt: sql`now()`,
              updatedById: SYSTEM_SERVICE_ACCOUNT_ID,
            },
          })
        yield* transaction
          .insert(platforms)
          .values({ id: PLATFORM_ID })
          .onConflictDoNothing()
        yield* transaction
          .insert(authorizationScopes)
          .values({ id: PLATFORM_ID })
          .onConflictDoNothing()

        const systemAccount = objectRow({
          ancestorIds: [PLATFORM_ID],
          id: SYSTEM_SERVICE_ACCOUNT_ID,
          objectType: "serviceAccount",
          parentId: PLATFORM_ID,
        })
        yield* transaction
          .insert(objects)
          .values(systemAccount)
          .onConflictDoUpdate({
            target: objects.id,
            set: {
              etag: sql`gen_random_uuid()::text`,
              systemManaged: true,
              updatedAt: sql`now()`,
              updatedById: SYSTEM_SERVICE_ACCOUNT_ID,
            },
          })
        yield* transaction
          .insert(actors)
          .values({ id: SYSTEM_SERVICE_ACCOUNT_ID })
          .onConflictDoNothing()
        yield* transaction
          .insert(identities)
          .values({ id: SYSTEM_SERVICE_ACCOUNT_ID })
          .onConflictDoNothing()

        const expectedObjects = [
          {
            ancestorIds: [],
            id: PLATFORM_ID,
            objectType: "platform",
            parentId: null,
          },
          {
            ancestorIds: [PLATFORM_ID],
            id: SYSTEM_SERVICE_ACCOUNT_ID,
            objectType: "serviceAccount",
            parentId: PLATFORM_ID,
          },
        ] as const
        const storedObjects = yield* transaction
          .select({
            ancestorIds: objects.ancestorIds,
            id: objects.id,
            objectType: objects.objectType,
            parentId: objects.parentId,
          })
          .from(objects)
          .where(
            inArray(
              objects.id,
              expectedObjects.map(({ id }) => id)
            )
          )
        const storedById = new Map(
          storedObjects.map((record) => [record.id, record])
        )
        for (const expected of expectedObjects) {
          const stored = storedById.get(expected.id)
          if (
            stored === undefined ||
            stored.objectType !== expected.objectType ||
            stored.parentId !== expected.parentId ||
            stored.ancestorIds.length !== expected.ancestorIds.length ||
            stored.ancestorIds.some(
              (ancestorId, index) => ancestorId !== expected.ancestorIds[index]
            )
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
