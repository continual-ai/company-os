import { Timestamp, type ObjectGetInput } from "@company/runtime"
import { Model } from "company-os/model"
import { Data, DateTime, Effect } from "effect"

import { LeadConverted } from "@/modules/sales/lead/model"
import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import { EventJournal } from "@/server/events/event-journal"
import { makeLinkWriter } from "@/server/model/link-service"
import { ObjectRepositories } from "@/server/model/object-repositories"
import { makeObjectWriter } from "@/server/model/object-service"
import { RecordIdentifierResolver } from "@/server/model/record-identifier-resolver"

class LeadConversionConflict extends Data.TaggedError(
  "LeadConversionConflict"
)<{}> {}

class LeadCompanyRequired extends Data.TaggedError("LeadCompanyRequired")<{}> {}

export const convertLead = Effect.fn("sales.convertLead")(function* (
  input: ObjectGetInput<typeof Model.objects.lead>
) {
  const events = yield* EventJournal
  const authorization = yield* Authorization
  const database = yield* Database
  const identifiers = yield* RecordIdentifierResolver
  const repositories = yield* ObjectRepositories
  const repository = repositories.lead
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

  const id = yield* identifiers.resolve("lead", input.id)
  return yield* database.transaction(() =>
    Effect.gen(function* () {
      yield* authorization.requireOperation({
        operationId: "convert",
        objectType: "lead",
        recordIds: [id],
      })
      yield* authorization.requireOperation({
        objectType: "lead",
        operationId: "get",
        recordIds: [id],
      })
      const lead = yield* repository.get(id)
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

      let companyId = lead.company
      if (companyId !== null) {
        yield* authorization.requireOperation({
          objectType: "company",
          operationId: "get",
          recordIds: [companyId],
        })
      } else {
        if (lead.companyName === null || lead.companyName.trim() === "") {
          return yield* Effect.fail(new LeadCompanyRequired())
        }
        companyId = (yield* companies.create({ name: lead.companyName })).id
      }
      const contact = yield* contacts.create({
        email: lead.email,
        name: lead.name,
        phone: lead.phone,
      })
      yield* links.initialize(Model.objects.contact, contact.id, {
        primaryCompany: companyId,
      })
      const convertedAt = yield* DateTime.now
      yield* leads.update({
        company: companyId,
        convertedAt: Timestamp(DateTime.formatIso(convertedAt)),
        convertedCompany: companyId,
        convertedContact: contact.id,
        etag: lead.etag,
        id,
      })
      yield* events.append(LeadConverted, {
        subject: id,
        data: { company: companyId, contact: contact.id },
      })
      return { company: companyId, contact: contact.id }
    })
  )
})
