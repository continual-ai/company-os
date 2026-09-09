import { Effect } from "effect"
import { expect, it } from "vitest"

import { MarketingModule } from "#/modules/marketing/model/index.ts"
import { NotesModule } from "#/modules/notes/model/index.ts"
import { SalesModule } from "#/modules/sales/model/index.ts"
import { Actor, AccessModule, Root } from "#/runtime/access/model/index.ts"
import { AssetsModule } from "#/runtime/assets/model/index.ts"
import { defineModel } from "#/runtime/model/index.ts"
import { Database, Records } from "#/runtime/server/index.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

it("persists its own model with only declared dependencies", async () => {
  const model = defineModel({
    name: "Marketing test",
    root: Root,
    actor: Actor,
    modules: [
      AccessModule,
      AssetsModule,
      NotesModule,
      SalesModule,
      MarketingModule,
    ],
  })
  const fixture = await testFoundation(model)
  try {
    await Effect.runPromise(
      Effect.gen(function* () {
        const records = yield* Records
        const { sql } = yield* Database
        const record = yield* records
          .writer(model.objects.campaign)
          .create({ name: "Standalone campaign" })
        expect(
          (yield* records.get(model.objects.campaign).get(record.id)).name
        ).toBe("Standalone campaign")
        expect(yield* sql`select to_regclass('issues') as unrelated`).toEqual([
          { unrelated: null },
        ])
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
