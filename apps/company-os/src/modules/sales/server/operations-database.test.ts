import { Effect, Exit } from "effect"
import { expect } from "vitest"

import { NotesModule } from "#/modules/notes/model/index.ts"
import { Deal } from "#/modules/sales/model/deal.ts"
import { SalesModule } from "#/modules/sales/model/index.ts"
import { Lead } from "#/modules/sales/model/lead.ts"
import { convertLead } from "#/modules/sales/server/convert-lead.ts"
import { SalesServer } from "#/modules/sales/server/index.ts"
import { pipelineSummary } from "#/modules/sales/server/pipeline-summary.ts"
import { AccessModule } from "#/runtime/access/model/index.ts"
import { AssetsModule } from "#/runtime/assets/model/index.ts"
import { defineModel, Decimal, CurrencyCode } from "#/runtime/model/index.ts"
import { Database, Records } from "#/runtime/server/index.ts"
import { anonymousInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(
  defineModel({
    name: "Sales test",
    modules: [AccessModule, AssetsModule, NotesModule, SalesModule],
  }),
  { servers: [SalesServer] }
)

fixture.test(
  "uses the real foundation for authorization, atomic conversion, events and SQL reports without an app",
  () =>
    Effect.gen(function* () {
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
      expect((yield* sql`select count(*)::int as n from companies`)[0]?.n).toBe(
        0
      )
      expect((yield* sql`select count(*)::int as n from contacts`)[0]?.n).toBe(
        0
      )
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
    })
)
