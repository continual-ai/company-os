import { Effect, Schema } from "effect"

import {
  PipelineSummaryQuery,
  Opportunity,
} from "#/modules/sales/model/opportunity.ts"
import { toEffectSchema } from "#/runtime/contract/schema.ts"
import { Database } from "#/runtime/server/index.ts"

const Output = toEffectSchema(PipelineSummaryQuery.output)

/** Aggregates project records, preserving exact decimal values and currency boundaries. */
export const pipelineSummary = Effect.fn("sales.pipelineSummary")(function* () {
  const database = yield* Database
  const sql = database.sql
  const opportunities = database.table(Opportunity)
  const currency = sql`${opportunities.columns.amount}->>'currency'`
  const groups = yield* sql`select
            ${opportunities.columns.stage} as stage,
            ${currency} as currency,
            count(*)::double precision as count,
            sum((${opportunities.columns.amount}->>'amount')::numeric)::text as amount
          from ${opportunities}
          group by ${sql.csv([opportunities.columns.stage, currency])}
          order by ${sql.csv([opportunities.columns.stage, currency])}`
  return yield* Schema.decodeUnknownEffect(Output)({ groups })
})
