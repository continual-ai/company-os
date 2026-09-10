import { Effect } from "effect"
import { expect } from "vitest"

import { seedSystem } from "#/app/server/seeds/seed-system.ts"
import { testApplication } from "#/app/server/test-application.ts"
import {
  SYSTEM_SERVICE_ACCOUNT_ID,
  ANONYMOUS_ACTOR_ID,
  ROOT_ID,
} from "#/runtime/model/system-records.ts"
import { authenticatedInvocation } from "#/runtime/server/invocation-context.ts"
import { Database } from "#/runtime/server/storage/database.ts"
const application = testApplication()
application.test(
  "converges attribution identities and protects the reserved system identity",
  () =>
    Effect.gen(function* () {
      yield* seedSystem()
      yield* seedSystem()
      const { sql } = yield* Database
      const rows = yield* sql<{
        id: string
        systemManaged: boolean
      }>`select id, system_managed as "systemManaged" from objects where id in (${ROOT_ID}, ${SYSTEM_SERVICE_ACCOUNT_ID}, ${ANONYMOUS_ACTOR_ID})`
      expect(rows).toHaveLength(3)
      expect(rows.every((row) => row.systemManaged)).toBe(true)
      expect(
        yield* authenticatedInvocation(SYSTEM_SERVICE_ACCOUNT_ID).pipe(
          Effect.flip
        )
      ).toMatchObject({ _tag: "ReservedSystemActor" })
      expect(
        yield* sql`select id from interface_actor where id = ${SYSTEM_SERVICE_ACCOUNT_ID}`
      ).toHaveLength(1)
      expect(
        yield* sql`select id from interface_identity where id = ${SYSTEM_SERVICE_ACCOUNT_ID}`
      ).toHaveLength(1)
    })
)
