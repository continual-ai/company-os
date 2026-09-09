import { DateTime, Effect } from "effect"

import { Company } from "#/modules/sales/model/company.ts"
import { Contact } from "#/modules/sales/model/contact.ts"
import { Lead, LeadConverted } from "#/modules/sales/model/lead.ts"
import {
  Timestamp,
  type ApiError,
  type FailedPreconditionError,
  type Violation,
  type ObjectGetInput,
} from "#/runtime/model/index.ts"
import {
  Database,
  Records,
  Authorization,
  EventJournal,
  makeLinkWriter,
  RecordIdentifierResolver,
} from "#/runtime/server/index.ts"

function precondition(
  violation: Violation
): ApiError<typeof FailedPreconditionError> {
  return {
    status: "FAILED_PRECONDITION",
    reason: "FAILED_PRECONDITION",
    message: "The lead cannot be converted.",
    details: { violations: [violation] },
  }
}

export const convertLead = Effect.fn("sales.convertLead")(function* (
  input: ObjectGetInput<typeof Lead>
) {
  const events = yield* EventJournal
  const authorization = yield* Authorization
  const database = yield* Database
  const records = yield* Records
  const repository = records.get(Lead)
  const companies = records.writer(Company)
  const contacts = records.writer(Contact)
  const leads = records.writer(Lead)
  const links = yield* makeLinkWriter
  const id = yield* (yield* RecordIdentifierResolver).resolve("lead", input.id)
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
        return yield* Effect.fail(
          precondition({
            message: "The lead has an incomplete prior conversion.",
            reason: "LEAD_CONVERSION_STATE_INVALID",
          })
        )
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
          return yield* Effect.fail(
            precondition({
              message:
                "Select a company or enter a company name before converting this lead.",
              path: ["companyName"],
              reason: "LEAD_COMPANY_REQUIRED",
            })
          )
        }
        companyId = (yield* companies.create({ name: lead.companyName })).id
      }
      const contact = yield* contacts.create({
        email: lead.email,
        name: lead.name,
        phone: lead.phone,
      })
      yield* links.initialize(Contact, contact.id, {
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
        subject: lead.id,
        data: { company: companyId, contact: contact.id },
      })
      return { company: companyId, contact: contact.id }
    })
  )
})
