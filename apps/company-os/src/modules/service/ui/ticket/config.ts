import { Model } from "#/app.model.ts"
import { Ticket } from "#/modules/service/model/ticket.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const ticketUi = {
  collection: {
    views: [
      defineCollectionView(Model, Ticket, "all", "All tickets", {
        columns: [
          "subject",
          "status",
          "priority",
          "account",
          "owner",
          "respondByAt",
        ],
      }),
      defineCollectionView(Model, Ticket, "triage", "Triage", {
        columns: [
          "subject",
          "status",
          "priority",
          "account",
          "owner",
          "respondByAt",
        ],
        filters: [
          { id: "status", value: { operator: "equals", values: ["new"] } },
        ],
      }),
      defineCollectionView(Model, Ticket, "open", "Open", {
        columns: [
          "subject",
          "status",
          "priority",
          "account",
          "owner",
          "respondByAt",
        ],
        filters: [
          {
            id: "status",
            value: { operator: "equals", values: ["open", "waitingOnTeam"] },
          },
        ],
      }),
      defineCollectionView(Model, Ticket, "waiting", "Waiting on customer", {
        columns: [
          "subject",
          "status",
          "priority",
          "account",
          "owner",
          "respondByAt",
        ],
        filters: [
          {
            id: "status",
            value: { operator: "equals", values: ["waitingOnCustomer"] },
          },
        ],
      }),
      defineCollectionView(Model, Ticket, "board", "Board", {
        layout: { type: "kanban", groupBy: "status" },
        columns: ["subject", "priority", "account", "owner"],
      }),
      defineCollectionView(Model, Ticket, "calendar", "Response calendar", {
        layout: { type: "calendar", start: "respondByAt" },
        columns: ["subject", "priority", "owner"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Ticket>
