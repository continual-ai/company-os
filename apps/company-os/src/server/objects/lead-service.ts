import { Model } from "@company/model"
import {
  isRecordAlias,
  RecordId,
  Timestamp,
  type RecordIdentifier,
} from "@company/runtime"
import { Context, Data, Effect, Layer } from "effect"

import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import { makeRecordAliasResolver } from "@/server/database/model-storage"
import { currentActorId } from "@/server/invocation-context"

import { CompanyRepository } from "./company-repository"
import { ContactRepository } from "./contact-repository"
import { LeadRepository } from "./lead-repository"
import { makeObjectService } from "./object-service"

class LeadConversionConflict extends Data.TaggedError(
  "LeadConversionConflict"
)<{}> {}

const make = Effect.gen(function* () {
  const authorization = yield* Authorization
  const database = yield* Database
  const repository = yield* LeadRepository
  const companyRepository = yield* CompanyRepository
  const contactRepository = yield* ContactRepository
  const resolveAliases = yield* makeRecordAliasResolver
  const base = yield* makeObjectService(Model.objects.lead, repository)
  const companies = yield* makeObjectService(
    Model.objects.company,
    companyRepository
  )
  const contacts = yield* makeObjectService(
    Model.objects.contact,
    contactRepository
  )

  const convert = Effect.fn("@company/LeadService.convert")(function* (
    identifier: RecordIdentifier<"lead">
  ) {
    const id = isRecordAlias(identifier)
      ? RecordId("lead")((yield* resolveAliases("lead", [identifier]))[0]!)
      : RecordId("lead")(identifier)
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* authorization.requireAction({
          actionId: "convert",
          modifiesTarget: true,
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
          primaryCompany: company.id,
        })
        yield* repository.update({
          convertedAt: Timestamp(new Date().toISOString()),
          convertedCompany: company.id,
          convertedContact: contact.id,
          etag: lead.etag,
          id,
          updatedBy: yield* currentActorId,
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
