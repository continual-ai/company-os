import { DateTime, Effect } from "effect"

import { Company } from "#/modules/sales/model/company.ts"
import { Contact } from "#/modules/sales/model/contact.ts"
import { Lead, LeadConverted } from "#/modules/sales/model/lead.ts"
import {
  Timestamp,
  type ApiError,
  type FailedPreconditionError,
  type ObjectGetInput,
  type Violation,
} from "#/runtime/model/index.ts"
import { linkedId } from "#/runtime/model/record-links.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import {
  Database,
  EventJournal,
  Links,
  RecordIdentifierResolver,
  Records,
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
  const database = yield* Database
  const records = yield* Records
  const repository = records.get(Lead)
  const companies = records.writer(Company)
  const contacts = records.writer(Contact)
  const leads = records.writer(Lead)
  const contactLinks = (yield* Links).writer(Contact)
  const id = yield* (yield* RecordIdentifierResolver).resolve("lead", input.id)
  return yield* database.transaction(() =>
    Effect.gen(function* () {
      yield* requireProjectAccess
      const lead = yield* repository.get(id)
      const convertedCompany = linkedId(lead, "convertedCompany", Company)
      const convertedContact = linkedId(lead, "convertedContact", Contact)
      const company = linkedId(lead, "company", Company)
      if (convertedCompany !== null && convertedContact !== null) {
        return {
          company: convertedCompany,
          contact: convertedContact,
        }
      }
      if (
        convertedCompany !== null ||
        convertedContact !== null ||
        lead.convertedAt !== null
      ) {
        return yield* Effect.fail(
          precondition({
            message: "The lead has an incomplete prior conversion.",
            reason: "LEAD_CONVERSION_STATE_INVALID",
          })
        )
      }

      let companyId = company
      if (companyId !== null) {
        yield* requireProjectAccess
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
      yield* contactLinks.initialize(contact.id, {
        companies: [companyId],
        primaryCompany: [companyId],
      })
      const convertedAt = yield* DateTime.now
      yield* leads.update({
        convertedAt: Timestamp(DateTime.formatIso(convertedAt)),
        etag: lead.etag,
        id,
        links: {
          company: { replace: [companyId] },
          convertedCompany: { replace: [companyId] },
          convertedContact: { replace: [contact.id] },
        },
      })
      yield* events.append(LeadConverted, {
        subject: lead.id,
        data: { company: companyId, contact: contact.id },
      })
      return { company: companyId, contact: contact.id }
    })
  )
})
