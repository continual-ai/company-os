import { Model } from "@company/model"
import { and, eq, isNull } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"

import { Database } from "@/server/database/database.server"
import { makeObjectRepository } from "@/server/database/model-storage.server"
import { invitationCredentials } from "@/server/database/schema.server"

const make = Effect.gen(function* () {
  const database = yield* Database
  const base = yield* makeObjectRepository(Model.objects.invitation)

  const insertCredential = Effect.fn(
    "@company/InvitationRepository.insertCredential"
  )(function* (invitationId: string, secretHash: string) {
    yield* database
      .insert(invitationCredentials)
      .values({ invitationId, secretHash })
  })

  const lockCredential = Effect.fn(
    "@company/InvitationRepository.lockCredential"
  )(function* (invitationId: string) {
    const rows = yield* database
      .select({
        consumedAt: invitationCredentials.consumedAt,
        secretHash: invitationCredentials.secretHash,
      })
      .from(invitationCredentials)
      .where(eq(invitationCredentials.invitationId, invitationId))
      .for("update")
    return rows[0]
  })

  const consumeCredential = Effect.fn(
    "@company/InvitationRepository.consumeCredential"
  )(function* (invitationId: string, consumedAt: Date) {
    yield* database
      .update(invitationCredentials)
      .set({ consumedAt })
      .where(
        and(
          eq(invitationCredentials.invitationId, invitationId),
          isNull(invitationCredentials.consumedAt)
        )
      )
  })

  return {
    ...base,
    consumeCredential,
    insertCredential,
    lockCredential,
  }
})

export class InvitationRepository extends Context.Service<InvitationRepository>()(
  "@company/InvitationRepository",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
