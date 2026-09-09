import { Effect, Schema } from "effect"

import { Deal } from "#/modules/sales/model/deal.ts"
import { toEffectSchema } from "#/runtime/contract/schema.ts"
import {
  Database,
  Authorization,
  ModelContext,
} from "#/runtime/server/index.ts"
import { inValues } from "#/runtime/server/postgres/index.ts"

const Output = toEffectSchema(Deal.queries.pipelineSummary.output)

/** Aggregates only readable records, preserving exact decimal values and currency boundaries. */
export const pipelineSummary = Effect.fn("sales.pipelineSummary")(function* () {
  const authorization = yield* Authorization
  const database = yield* Database
  const sql = database.sql
  const context = yield* ModelContext
  const deals = context.table(Deal)
  const objects = context.storage.core.objects
  yield* authorization.requireOperation({
    objectType: "deal",
    operationId: "pipelineSummary",
  })
  const scopes = yield* authorization.visibleWithin({
    objectType: "deal",
    operation: "get",
  })
  if (scopes.length === 0) return { groups: [] }
  const currency = sql`${deals.columns.amount}->>'currency'`
  const groups = yield* sql`select
            ${deals.columns.stage} as stage,
            ${currency} as currency,
            count(*)::double precision as count,
            sum((${deals.columns.amount}->>'amount')::numeric)::text as amount
          from ${deals}
          inner join ${objects} on ${objects.columns.id} = ${deals.columns.id}
          where (${inValues(sql, objects.columns.id, scopes)} or ${objects.columns.ancestorIds} && array[${sql.join(", ", false)(scopes.map((id) => sql`${id}`))}]::text[])
          group by ${sql.csv([deals.columns.stage, currency])}
          order by ${sql.csv([deals.columns.stage, currency])}`
  return yield* Schema.decodeUnknownEffect(Output)({ groups })
})
