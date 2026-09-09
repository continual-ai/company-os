import { Effect } from "effect"
import { expect, it } from "vitest"

import { EngineeringModule } from "#/modules/engineering/model/index.ts"
import { NotesModule } from "#/modules/notes/model/index.ts"
import { AccessModule } from "#/runtime/access/model/index.ts"
import { AssetsModule } from "#/runtime/assets/model/index.ts"
import { defineModel } from "#/runtime/model/index.ts"
import { Database, Records } from "#/runtime/server/index.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

it("persists its own model with only declared dependencies", async () => {
  const model = defineModel({
    name: "Engineering test",
    modules: [AccessModule, AssetsModule, NotesModule, EngineeringModule],
  })
  const fixture = await testFoundation(model)
  try {
    await Effect.runPromise(
      Effect.gen(function* () {
        const records = yield* Records
        const { sql } = yield* Database
        const record = yield* records
          .writer(model.objects.project)
          .create({ name: "Standalone project" })
        expect(
          (yield* records.get(model.objects.project).get(record.id)).name
        ).toBe("Standalone project")
        expect(
          yield* sql`select to_regclass('companies') as unrelated`
        ).toEqual([{ unrelated: null }])
        expect(
          (yield* sql`select count(*)::int as count from event_journal`)[0]
            ?.count
        ).toBeGreaterThan(0)
      }).pipe(
        Effect.provideService(CurrentInvocation, systemInvocation),
        Effect.provide(fixture.layer)
      )
    )
  } finally {
    await fixture.dispose()
  }
}, 15000)
