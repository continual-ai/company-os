import { Effect, Layer, Exit, ConfigProvider } from "effect"
import { beforeAll, afterAll, expect, it } from "vitest"

import { NotesModule } from "#/modules/notes/model/index.ts"
import { Deal } from "#/modules/sales/model/deal.ts"
import { SalesModule } from "#/modules/sales/model/index.ts"
import { Lead } from "#/modules/sales/model/lead.ts"
import { convertLead } from "#/modules/sales/server/convert-lead.ts"
import { pipelineSummary } from "#/modules/sales/server/pipeline-summary.ts"
import { Actor, AccessModule, Root } from "#/runtime/access/model/index.ts"
import { bootstrapSystemActor } from "#/runtime/access/server/bootstrap.ts"
import { seedAuthorization } from "#/runtime/access/server/seed.ts"
import { AssetsModule } from "#/runtime/assets/model/index.ts"
import { defineModel, Decimal, CurrencyCode } from "#/runtime/model/index.ts"
import { infrastructureStatements } from "#/runtime/server/database/schema.ts"
import { foundationLayer } from "#/runtime/server/foundation.ts"
import { Database, Records, ModelContext } from "#/runtime/server/index.ts"
import {
  systemInvocation,
  anonymousInvocation,
} from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { makePostgresSchema } from "#/runtime/server/postgres/index.ts"
import { TestDatabase } from "#/runtime/server/postgres/testing.ts"

const model = defineModel({
  name: "Sales test",
  root: Root,
  actor: Actor,
  modules: [AccessModule, AssetsModule, SalesModule, NotesModule],
})
const storage = makePostgresSchema(model)
let template: Awaited<ReturnType<typeof TestDatabase.createTemplate>>
beforeAll(async () => {
  template = await TestDatabase.createTemplate(
    [
      ...storage.ddl,
      ...infrastructureStatements,
      "insert into event_journal_state (id, position) values (1, 0)",
    ].join(";\n")
  )
})
afterAll(async () => {
  if (template) await TestDatabase.drop(template)
})

it("uses the real foundation for authorization, atomic conversion, events and SQL reports without an app", async () => {
  const database = Database.layer.pipe(
    Layer.provide(ModelContext.layer(model)),
    Layer.provide(TestDatabase.layer(template))
  )
  const foundation = foundationLayer(model, { database })
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        yield* bootstrapSystemActor()
        yield* seedAuthorization()
        const { sql } = yield* Database
        const records = yield* Records
        const leads = records.writer(Lead)
        const lead = yield* leads.create({
          name: "Maya Chen",
          companyName: "Northstar",
        })
        expect(
          Exit.isFailure(
            yield* Effect.exit(
              convertLead({ id: lead.id }).pipe(
                Effect.provideService(CurrentInvocation, anonymousInvocation)
              )
            )
          )
        ).toBe(true)
        yield* sql.unsafe(
          `create function fail_conversion() returns trigger language plpgsql as $$ begin if new.type = 'lead.converted' then raise exception 'Test journal failure'; end if; return new; end; $$`
        )
        yield* sql.unsafe(
          `create trigger fail_conversion before insert on event_journal for each row execute function fail_conversion()`
        )
        expect(
          Exit.isFailure(yield* Effect.exit(convertLead({ id: lead.id })))
        ).toBe(true)
        expect((yield* records.get(Lead).get(lead.id)).convertedAt).toBeNull()
        expect(
          (yield* sql`select count(*)::int as n from companies`)[0]?.n
        ).toBe(0)
        expect(
          (yield* sql`select count(*)::int as n from contacts`)[0]?.n
        ).toBe(0)
        yield* sql.unsafe(`drop trigger fail_conversion on event_journal`)
        const result = yield* convertLead({ id: lead.id })
        expect(yield* convertLead({ id: lead.id })).toEqual(result)
        expect(
          (yield* sql`select count(*)::int as n from event_journal where type = 'lead.converted'`)[0]
            ?.n
        ).toBe(1)
        for (const [currency, amount] of [
          ["USD", "0.10"],
          ["USD", "0.20"],
          ["EUR", "12.30"],
        ] as const) {
          yield* records.writer(Deal).create({
            parent: result.company,
            name: "Opportunity",
            amount: {
              currency: CurrencyCode(currency),
              amount: Decimal(amount),
            },
          })
        }
        expect(
          Exit.isFailure(
            yield* Effect.exit(
              pipelineSummary().pipe(
                Effect.provideService(CurrentInvocation, anonymousInvocation)
              )
            )
          )
        ).toBe(true)
        expect(
          (yield* pipelineSummary()).groups.map(({ currency, amount }) => ({
            currency,
            amount,
          }))
        ).toEqual([
          { currency: "EUR", amount: "12.30" },
          { currency: "USD", amount: "0.30" },
        ])
        expect(
          yield* sql`select to_regclass('campaigns') as marketing, to_regclass('issues') as engineering`
        ).toEqual([{ marketing: null, engineering: null }])
      }).pipe(
        Effect.provideService(CurrentInvocation, systemInvocation),
        Effect.provide(foundation),
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            APP_SECRET: "sales-test-signing-key-at-least-32-characters",
          })
        )
      )
    )
  )
}, 15000)
