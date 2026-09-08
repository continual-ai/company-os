import { insertValues } from "@company/postgres"
import { projection, type SelectionRow } from "@company/postgres"
import { RecordId, type RecordId as RecordIdType } from "@company/runtime"
import { Context, Effect, Layer } from "effect"

import { Database } from "#/server/database/database.ts"
import { identityBindings, objects } from "#/server/database/schema.ts"

export type BoundIdentity =
  | { readonly id: RecordId<"serviceAccount">; readonly kind: "serviceAccount" }
  | { readonly id: RecordId<"user">; readonly kind: "user" }

const make = Effect.gen(function* () {
  const database = yield* Database
  const sql = database.sql

  const find = Effect.fn("@company/IdentityBindingRepository.find")(function* (
    issuer: string,
    subject: string
  ) {
    const rowsFields = {
      identityId: identityBindings.columns.identityId,
      objectType: objects.columns.objectType,
    }
    const rows = yield* sql<
      SelectionRow<typeof rowsFields>
    >`select ${projection(rowsFields)}
          from ${identityBindings}
          inner join ${objects} on ${identityBindings.columns.identityId} = ${objects.columns.id}
          where (${identityBindings.columns.issuer} = ${issuer} and ${identityBindings.columns.subject} = ${subject})
          limit ${1}`
    const binding = rows[0]
    if (binding === undefined) return undefined
    if (binding.objectType === "user") {
      return {
        id: RecordId("user")(binding.identityId),
        kind: "user" as const,
      }
    }
    if (binding.objectType === "serviceAccount") {
      return {
        id: RecordId("serviceAccount")(binding.identityId),
        kind: "serviceAccount" as const,
      }
    }
    return yield* Effect.die(
      `Identity binding '${issuer}:${subject}' points to ${binding.objectType}.`
    )
  })

  const bind = Effect.fn("@company/IdentityBindingRepository.bind")(
    function* (input: {
      readonly identityId: RecordIdType<"serviceAccount"> | RecordIdType<"user">
      readonly issuer: string
      readonly subject: string
    }) {
      yield* sql`insert into ${identityBindings} ${insertValues(sql, identityBindings, input)}`
    }
  )

  return { bind, find }
})

/** Maps verified external subjects to canonical local Identity objects. */
export class IdentityBindingRepository extends Context.Service<IdentityBindingRepository>()(
  "@company/IdentityBindingRepository",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
