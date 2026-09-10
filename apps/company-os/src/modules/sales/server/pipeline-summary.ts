import { Effect, Schema } from "effect"

import { Deal } from "#/modules/sales/model/deal.ts"
import { toEffectSchema } from "#/runtime/contract/schema.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { Database, ModelContext } from "#/runtime/server/index.ts"

const Output = toEffectSchema(Deal.queries.pipelineSummary.output)

/** Aggregates project records, preserving exact decimal values and currency boundaries. */
export const pipelineSummary = Effect.fn("sales.pipelineSummary")(function* () {
  const database = yield* Database
  const sql = database.sql
  const context = yield* ModelContext
  const deals = context.table(Deal)
  yield* requireProjectAccess
  const currency = sql`${deals.columns.amount}->>'currency'`
  const groups = yield* sql`select
            ${deals.columns.stage} as stage,
            ${currency} as currency,
            count(*)::double precision as count,
            sum((${deals.columns.amount}->>'amount')::numeric)::text as amount
          from ${deals}
          group by ${sql.csv([deals.columns.stage, currency])}
          order by ${sql.csv([deals.columns.stage, currency])}`
  return yield* Schema.decodeUnknownEffect(Output)({ groups })
})
