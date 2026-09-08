import { NotesModule } from "@company/notes/model"
import { defineModel } from "@company/runtime/model"
import { Actor, AccessModule, Root } from "@company/runtime/model/access"
import { AssetsModule } from "@company/runtime/model/assets"
import { Database, Records } from "@company/runtime/server"
import { CurrentInvocation } from "@company/runtime/server/invocation"
import { systemInvocation } from "@company/runtime/server/invocation-context"
import { testFoundation } from "@company/runtime/testing/foundation"
import { SalesModule } from "@company/sales/model"
import { Effect } from "effect"
import { expect, it } from "vitest"

import { MarketingModule } from "#/model/index.ts"

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
