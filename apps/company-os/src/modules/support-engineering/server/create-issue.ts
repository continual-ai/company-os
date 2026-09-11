import { Effect, Schema } from "effect"

import { Issue } from "#/modules/engineering/model/index.ts"
import {
  Escalation,
  TicketEscalated,
} from "#/modules/support-engineering/model/index.ts"
import { Ticket } from "#/modules/support/model/index.ts"
import { toEffectSchema } from "#/runtime/contract/schema.ts"
import type {
  ActionInput,
  ApiError,
  FailedPreconditionError,
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

const Input = toEffectSchema(Escalation.actions.createIssue.input)

/** Escalation owns the receipt, issue and association in one transaction, including concurrent retries. */
export const createIssue = Effect.fn("supportEngineering.createIssue")(
  function* (input: ActionInput<typeof Escalation.actions.createIssue>) {
    yield* Schema.decodeUnknownEffect(Input)(input)
    const database = yield* Database
    const records = yield* Records
    const events = yield* EventJournal
    const ticketLinks = (yield* Links).writer(Ticket)
    const ticketId = yield* (yield* RecordIdentifierResolver).resolve(
      "ticket",
      input.ticket
    )
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* requireProjectAccess
        // Serialize retries before looking for a receipt; the unique constraint is a second integrity guard.
        yield* database.sql`select pg_advisory_xact_lock(hashtextextended(${`support-escalation:${ticketId}`}, 0))`
        const existing = (yield* records.get(Escalation).list({
          filter: { link: "ticket", contains: ticketId },
        })).items[0]
        if (existing) {
          yield* requireProjectAccess
          const issue = linkedId(existing, "issue", Issue)
          if (issue === null)
            return yield* Effect.die(
              "Escalation is missing its required issue."
            )
          return { issue }
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
        yield* requireProjectAccess
        const issue = yield* records.writer(Issue).create({
          title: ticket.subject,
          description: ticket.description,
          priority: ticket.priority,
          status: "backlog",
        })
        yield* ticketLinks.update(ticket.id, { issues: { add: [issue.id] } })
        const escalation = yield* records.writer(Escalation).create({
          name: ticket.subject,
          links: { ticket: [ticket.id], issue: [issue.id] },
        })
        yield* events.append(TicketEscalated, {
          subject: escalation.id,
          data: { ticket: ticket.id, issue: issue.id },
        })
        return { issue: issue.id }
      })
    )
  }
)
