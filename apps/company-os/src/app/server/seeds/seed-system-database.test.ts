import { Effect } from "effect"
import { expect } from "vitest"

import { seedSystem } from "#/app/server/seeds/seed-system.ts"
import { testApplication } from "#/app/server/test-application.ts"
import {
  SYSTEM_SERVICE_ACCOUNT_ID,
  ANONYMOUS_ACTOR_ID,
} from "#/runtime/model/system-records.ts"
import {
  Controller,
  controllerAlias,
} from "#/runtime/platform/model/controller.ts"
import {
  ModuleSetting,
  moduleAlias,
} from "#/runtime/platform/model/module-setting.ts"
import { ControllerStorage } from "#/runtime/server/controllers/storage.ts"
import { Database } from "#/runtime/server/database.ts"
import { authenticatedInvocation } from "#/runtime/server/invocation-context.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"
const application = testApplication()
application.test(
  "converges attribution identities and protects the reserved system identity",
  () =>
    Effect.gen(function* () {
      yield* seedSystem()
      yield* seedSystem()
      const { sql } = yield* SqlDatabase
      const rows = yield* sql<{
        id: string
        systemManaged: boolean
      }>`select id, system_managed as "systemManaged" from objects where id in (${SYSTEM_SERVICE_ACCOUNT_ID}, ${ANONYMOUS_ACTOR_ID})`
      expect(rows).toHaveLength(2)
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

application.test(
  "synchronizes controller definitions and links without resetting execution progress",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const controllers = database.repository(Controller)
      const id = controllerAlias("contact-summary")
      const original = yield* controllers.get({ id })
      const storage = yield* ControllerStorage
      yield* storage.saveCursor("contact-summary", "saved-progress")
      yield* seedSystem()
      expect((yield* controllers.get({ id })).etag).toBe(original.etag)
      yield* controllers.update({ id, name: "Stale metadata", paused: true })
      const extra = yield* controllers.create({
        definitionId: "removed-controller",
        name: "Removed",
        description: "",
        targetObjectType: "task",
        scope: "record",
        watch: [],
        links: { module: moduleAlias("work") },
      })
      yield* storage.saveCursor("removed-controller", "old-progress")
      yield* seedSystem()
      expect(yield* controllers.get({ id })).toMatchObject({
        name: "Contact summary",
        paused: true,
      })
      expect(yield* storage.cursor("contact-summary")).toBe("saved-progress")
      expect(yield* storage.cursor("removed-controller")).toBeUndefined()
      expect(
        yield* controllers.get({ id: extra.id }).pipe(Effect.flip)
      ).toMatchObject({ _tag: "ObjectNotFound" })
    }).pipe(Effect.provide(ControllerStorage.layer))
)

application.test(
  "module registration uses stable aliases and preserves activation and record identity",
  () =>
    Effect.gen(function* () {
      const modules = (yield* Database).repository(ModuleSetting)
      const id = moduleAlias("work")
      const original = yield* modules.get({ id })
      expect(original.id).toMatch(/^module_setting_[0-9a-z]{26}$/)
      expect(original.aliases).toContain(id)
      yield* modules.update({ id, enabled: false })
      const disabled = yield* modules.get({ id })
      yield* Effect.all([seedSystem(), seedSystem()], { concurrency: 2 })
      expect(yield* modules.get({ id })).toMatchObject({
        id: original.id,
        enabled: false,
        etag: disabled.etag,
      })
    })
)
