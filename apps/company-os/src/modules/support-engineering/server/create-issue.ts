import { Issue } from "@company/engineering/model"
import { toEffectSchema } from "@company/runtime/contract/schema"
import type {
  ActionInput,
  ApiError,
  FailedPreconditionError,
} from "@company/runtime/model"
import { ROOT_ID } from "@company/runtime/model/system-records"
import {
  Authorization,
  Database,
  EventJournal,
  makeLinkWriter,
  Records,
  RecordIdentifierResolver,
} from "@company/runtime/server"
import { Effect, Schema } from "effect"

import {
  Escalation,
  TicketEscalated,
} from "#/modules/support-engineering/model/index.ts"
import { Ticket } from "#/modules/support/model/index.ts"

const Input = toEffectSchema(Escalation.actions.createIssue.input)

/** Escalation owns the receipt, issue and association in one transaction, including concurrent retries. */
export const createIssue = Effect.fn("supportEngineering.createIssue")(
  function* (input: ActionInput<typeof Escalation.actions.createIssue>) {
    yield* Schema.decodeUnknownEffect(Input)(input)
    const authorization = yield* Authorization
    const database = yield* Database
    const records = yield* Records
    const events = yield* EventJournal
    const links = yield* makeLinkWriter
    const ticketId = yield* (yield* RecordIdentifierResolver).resolve(
      "ticket",
      input.ticket
    )
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* authorization.requireOperation({
          objectType: "escalation",
          operationId: "createIssue",
        })
        yield* authorization.requireOperation({
          objectType: "ticket",
          operationId: "get",
          recordIds: [ticketId],
        })
        // Serialize retries before looking for a receipt; the unique constraint is a second integrity guard.
        yield* database.sql`select pg_advisory_xact_lock(hashtextextended(${`support-escalation:${ticketId}`}, 0))`
        const existing = (yield* records.get(Escalation).list({
          filter: { field: "ticket", operator: "eq", value: ticketId },
        })).items[0]
        if (existing) {
          yield* authorization.requireOperation({
            objectType: "issue",
            operationId: "get",
            recordIds: [existing.issue],
          })
          return { issue: existing.issue }
        }
        const ticket = yield* records.get(Ticket).get(ticketId)
        if (ticket.status === "resolved" || ticket.status === "closed") {
          return yield* Effect.fail({
            status: "FAILED_PRECONDITION",
            reason: "FAILED_PRECONDITION",
            message: "Reopen the ticket before escalating it.",
            details: {
              violations: [
                {
                  path: ["ticket"],
                  reason: "TICKET_CLOSED",
                  message: "Only open tickets can be escalated.",
                },
              ],
            },
          } satisfies ApiError<typeof FailedPreconditionError>)
        }
        yield* authorization.requireOperation({
          objectType: "issue",
          operationId: "create",
          parentId: ROOT_ID,
        })
        const issue = yield* records.writer(Issue).create({
          title: ticket.subject,
          description: ticket.description,
          priority: ticket.priority,
          status: "backlog",
        })
        yield* links.initialize(Ticket, ticket.id, { issues: [issue.id] })
        const escalation = yield* records
          .writer(Escalation)
          .create({ name: ticket.subject, ticket: ticket.id, issue: issue.id })
        yield* events.append(TicketEscalated, {
          subject: escalation.id,
          data: { ticket: ticket.id, issue: issue.id },
        })
        return { issue: issue.id }
      })
    )
  }
)
