import { Model } from "@company/model"
import { Timestamp, type ObjectGetInput } from "@company/runtime"
import { Context, Data, Effect, Layer } from "effect"

import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import { makeLinkWriter } from "@/server/model/link-service"
import { ObjectRepositories } from "@/server/model/object-repositories"
import {
  makeObjectService,
  makeObjectWriter,
} from "@/server/model/object-service"
import { RecordIdentifierResolver } from "@/server/model/record-identifier-resolver"

class LeadConversionConflict extends Data.TaggedError(
  "LeadConversionConflict"
)<{}> {}

const make = Effect.gen(function* () {
  const authorization = yield* Authorization
  const database = yield* Database
  const identifiers = yield* RecordIdentifierResolver
  const repositories = yield* ObjectRepositories
  const repository = repositories.lead
  const base = yield* makeObjectService(Model.objects.lead, repository)
  const companies = yield* makeObjectWriter(
    Model.objects.company,
    repositories.company
  )
  const contacts = yield* makeObjectWriter(
    Model.objects.contact,
    repositories.contact
  )
  const leads = yield* makeObjectWriter(Model.objects.lead, repository)
  const links = yield* makeLinkWriter

  const convert = Effect.fn("@company/LeadService.convert")(function* (
    input: ObjectGetInput<typeof Model.objects.lead>
  ) {
    const id = yield* identifiers.resolve("lead", input.id)
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* authorization.requireAction({
          actionId: "convert",
          objectType: "lead",
          recordIds: [id],
        })
        const lead = yield* base.get({ id })
        if (lead.convertedCompany !== null && lead.convertedContact !== null) {
          return {
            company: lead.convertedCompany,
            contact: lead.convertedContact,
          }
        }
        if (
          lead.convertedCompany !== null ||
          lead.convertedContact !== null ||
          lead.convertedAt !== null
        ) {
          return yield* Effect.fail(new LeadConversionConflict())
        }

        const company = yield* companies.create({ name: lead.companyName })
        const contact = yield* contacts.create({
          email: lead.email,
          name: lead.name,
          phone: lead.phone,
        })
        yield* links.initialize(Model.objects.contact, contact.id, {
          primaryCompany: company.id,
        })
        yield* leads.update({
          convertedAt: Timestamp(new Date().toISOString()),
          convertedCompany: company.id,
          convertedContact: contact.id,
          etag: lead.etag,
          id,
        })
        return { company: company.id, contact: contact.id }
      })
    )
  })

  return { ...base, convert }
})

/** Governed queries and actions for lead objects. */
export class LeadService extends Context.Service<LeadService>()(
  "@company/LeadService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
