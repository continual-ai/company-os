import { toEffectSchema } from "@company/runtime/effect"
import { Model } from "company-os/model"
import { count, eq, inArray, or, sql } from "drizzle-orm"
import { Effect, Schema } from "effect"

import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import { deals, objects } from "@/server/database/schema"

const Output = toEffectSchema(Model.objects.deal.queries.pipelineSummary.output)

/** Aggregates only readable records, preserving exact decimal values and currency boundaries. */
export const pipelineSummary = Effect.fn("sales.pipelineSummary")(function* () {
  const authorization = yield* Authorization
  const database = yield* Database
  yield* authorization.requireOperation({
    objectType: "deal",
    operationId: "pipelineSummary",
  })
  const scopes = yield* authorization.visibleWithin({
    objectType: "deal",
    operation: "get",
  })
  if (scopes.length === 0) return { groups: [] }
  const currency = sql<string | null>`${deals.amount}->>'currency'`
  const groups = yield* database
    .select({
      stage: deals.stage,
      currency,
      count: count(),
      amount: sql<
        string | null
      >`sum((${deals.amount}->>'amount')::numeric)::text`,
    })
    .from(deals)
    .innerJoin(objects, eq(objects.id, deals.id))
    .where(
      or(
        inArray(objects.id, scopes),
        sql`${objects.ancestorIds} && array[${sql.join(
          scopes.map((id) => sql`${id}`),
          sql`, `
        )}]::text[]`
      )
    )
    .groupBy(deals.stage, currency)
    .orderBy(deals.stage, currency)
  return yield* Schema.decodeUnknownEffect(Output)({ groups })
})
