import { Button } from "@company/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@company/ui/card"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { Escalation } from "#/modules/support-engineering/model/index.ts"
import { Ticket } from "#/modules/support/model/index.ts"
import {
  formErrorFromCause,
  formErrorMessages,
} from "#/runtime/ui/forms/form-errors.ts"
import { useObjectClient } from "#/runtime/ui/module.ts"

/** A workflow page can consume several governed objects without changing the shared renderer. */
export function EscalationPage() {
  const tickets = useQuery(
    useObjectClient(Ticket).list({
      pageSize: 50,
      filter: {
        field: "status",
        operator: "in",
        value: ["new", "open", "waitingOnCustomer", "waitingOnTeam"],
      },
    })
  )
  const escalation = useMutation(useObjectClient(Escalation).createIssue())
  return (
    <Card>
      <CardHeader>
        <CardTitle>Escalate a support ticket</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tickets.isPending ? <p>Loading tickets…</p> : null}
        {tickets.error || escalation.error ? (
          <p role="alert">
            {formErrorMessages([
              formErrorFromCause(
                tickets.error ?? escalation.error,
                "The request failed."
              ),
            ])
              .map((error) => error.message)
              .join(" ")}
          </p>
        ) : null}
        {tickets.data?.items.length === 0 ? (
          <p>No open support tickets.</p>
        ) : null}
        {tickets.data?.items.map((ticket) => (
          <div
            key={ticket.id}
            className="flex items-center justify-between gap-4 border-b py-3"
          >
            <Link
              to="/objects/$objectType/$recordId"
              params={{ objectType: "ticket", recordId: ticket.id }}
            >
              {ticket.subject}
            </Link>
            <Button
              disabled={escalation.isPending}
              onClick={() => escalation.mutate({ ticket: ticket.id })}
            >
              Create engineering issue
            </Button>
          </div>
        ))}
        {tickets.data?.nextPageToken ? (
          <p>
            Showing the first 50 open tickets. Open the ticket list to find
            older requests.
          </p>
        ) : null}
        {escalation.data ? (
          <Link
            to="/objects/$objectType/$recordId"
            params={{ objectType: "issue", recordId: escalation.data.issue }}
          >
            Open engineering issue
          </Link>
        ) : null}
      </CardContent>
    </Card>
  )
}
