import type { Ticket } from "#/modules/support/model/ticket.ts"
import { defineCollectionView } from "#/runtime/ui/module.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

export const ticketUi = {
  collection: {
    views: [
      defineCollectionView("all", "All tickets", {
        columns: [
          "subject",
          "status",
          "priority",
          "company",
          "owner",
          "respondByAt",
        ],
      }),
      defineCollectionView("triage", "Triage", {
        columns: [
          "subject",
          "status",
          "priority",
          "company",
          "owner",
          "respondByAt",
        ],
        filters: [
          { id: "status", value: { operator: "equals", values: ["new"] } },
        ],
      }),
      defineCollectionView("open", "Open", {
        columns: [
          "subject",
          "status",
          "priority",
          "company",
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
      defineCollectionView("waiting", "Waiting on customer", {
        columns: [
          "subject",
          "status",
          "priority",
          "company",
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
      defineCollectionView("board", "Board", {
        layout: { type: "kanban", groupBy: "status" },
        columns: ["subject", "priority", "company", "owner"],
      }),
      defineCollectionView("calendar", "Response calendar", {
        layout: { type: "calendar", start: "respondByAt" },
        columns: ["subject", "priority", "owner"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Ticket>
