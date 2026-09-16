import { Effect, Exit } from "effect"
import { expect } from "vitest"

import { Account, Contact } from "#/modules/crm/model/index.ts"
import { CrmModule } from "#/modules/crm/model/index.ts"
import { SalesModule } from "#/modules/sales/model/index.ts"
import { Lead } from "#/modules/sales/model/lead.ts"
import { Opportunity } from "#/modules/sales/model/opportunity.ts"
import { SalesServer } from "#/modules/sales/server/index.ts"
import { defineModel, Decimal, CurrencyCode } from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { Database } from "#/runtime/server/index.ts"
import { anonymousInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { operationsFor } from "#/runtime/server/operation-executor.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(
  defineModel({
    name: "Sales test",
    modules: [PlatformModule, CrmModule, SalesModule],
  }),
  { servers: [SalesServer] }
)

fixture.test(
  "uses the real foundation for authorization, atomic conversion, events and SQL reports without an app",
  () =>
    Effect.gen(function* () {
      const services = yield* operationsFor(fixture.model)
      const convertLead = services.lead.convert
      const pipelineSummary = services.opportunity.pipelineSummary
      const { sql } = yield* Database
      const records = yield* Database
      const leads = records.repository(Lead)
      const account = yield* records
        .repository(Account)
        .create({ name: "Northstar" })
      const contact = yield* records
        .repository(Contact)
        .create({ name: "Maya Chen" })
      const lead = yield* leads.create({
        name: "Northstar pilot",
        links: { account: account.id, contact: contact.id },
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
      expect(
        (yield* records.repository(Lead).get({ id: lead.id })).links.opportunity
      ).toBeNull()
      expect((yield* sql`select count(*)::int as n from accounts`)[0]?.n).toBe(
        1
      )
      expect((yield* sql`select count(*)::int as n from contacts`)[0]?.n).toBe(
        1
      )
      yield* sql.unsafe(`drop trigger fail_conversion on event_journal`)
      const result = yield* convertLead({ id: lead.id })
      expect(yield* convertLead({ id: lead.id })).toEqual(result)
      expect(
        (yield* sql`select count(*)::int as n from event_journal where type = 'lead.converted'`)[0]
          ?.n
      ).toBe(1)
      yield* records.repository(Opportunity).delete({ id: result.opportunity })
      expect((yield* leads.get({ id: lead.id })).links.opportunity).toBeNull()
      const replacement = yield* convertLead({ id: lead.id })
      expect(replacement.opportunity).not.toBe(result.opportunity)
      expect(yield* convertLead({ id: lead.id })).toEqual(replacement)
      expect((yield* leads.get({ id: lead.id })).links.opportunity).toBe(
        replacement.opportunity
      )
      expect((yield* sql`select count(*)::int as n from accounts`)[0]?.n).toBe(
        1
      )
      expect((yield* sql`select count(*)::int as n from contacts`)[0]?.n).toBe(
        1
      )
      for (const [currency, amount] of [
        ["USD", "0.10"],
        ["USD", "0.20"],
        ["EUR", "12.30"],
      ] as const) {
        yield* records.repository(Opportunity).create({
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
            pipelineSummary({}).pipe(
              Effect.provideService(CurrentInvocation, anonymousInvocation)
            )
          )
        )
      ).toBe(true)
      expect(
        (yield* pipelineSummary({})).groups
          .filter(({ currency }) => currency !== null)
          .map(({ currency, amount }) => ({
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
