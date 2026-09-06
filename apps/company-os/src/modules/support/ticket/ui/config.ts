import type { Model } from "company-os/model"

import type { ObjectUi } from "@/ui/model/module-ui"
import { defineCollectionView } from "@/ui/model/object-collection-view"

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
        sorting: [{ id: "subject", desc: false }],
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
    ],
  },
} satisfies ObjectUi<typeof Model.objects.ticket>
