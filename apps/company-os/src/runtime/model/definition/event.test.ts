import { expect, it } from "vitest"

import { Root } from "#/runtime/access/model/root.ts"
import { defineEvent } from "#/runtime/model/definition/event.ts"
import { defineObject } from "#/runtime/model/definition/object.ts"
import { schema } from "#/runtime/model/definition/schema.ts"

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
