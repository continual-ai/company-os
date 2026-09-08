import { expect, it } from "vitest"

import { Root } from "#/model/access/root.ts"
import { defineEvent } from "#/model/definition/event.ts"
import { defineObject } from "#/model/definition/object.ts"
import { schema } from "#/model/definition/schema.ts"

const Ticket = defineObject({
  id: "ticket",
  parent: Root,
  collection: "tickets",
  name: "Ticket",
  pluralName: "Tickets",
  properties: { title: schema.string() },
  display: { title: "title" },
})
it("keeps business facts distinct from standard record events", () => {
  for (const type of [
    "ticket.created",
    "ticket.updated",
    "ticket.deleted",
    "issue.escalated",
  ]) {
    expect(() =>
      defineEvent({
        type,
        subject: Ticket,
        version: 1,
        data: schema.object({}),
      })
    ).toThrow()
  }
  expect(
    defineEvent({
      type: "ticket.escalated",
      subject: Ticket,
      version: 1,
      data: schema.object({}),
    }).type
  ).toBe("ticket.escalated")
})
