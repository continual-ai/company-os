import { AcmeModel } from "@acme/api"
import { eq, sql } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"

import * as ObjectRepository from "@/server/database/object-repository.server"
import { leads } from "@/server/database/schema/leads"

const Lead = AcmeModel.objects.lead

const make = Effect.gen(function* () {
  const base = yield* ObjectRepository.make(Lead, leads)

  return {
    ...base,
    findByEmail: Effect.fn("lead.repository.findByEmail")((email: string) =>
      base.findManyWhere(eq(sql`lower(${leads.email})`, email.toLowerCase()))
    ),
  }
})

export class LeadRepository extends Context.Service<LeadRepository>()(
  "@acme/LeadRepository",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
