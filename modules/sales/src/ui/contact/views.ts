import { defineCollectionView } from "@company/runtime/ui/module"

export const contactViews = [
  defineCollectionView("all", "All contacts", {
    columns: ["name", "jobTitle", "email", "phone"],
  }),
  defineCollectionView("marketing", "Marketing contacts", {
    columns: ["name", "email", "marketingStatus", "emailPermission"],
    filters: [
      {
        id: "marketingStatus",
        value: { operator: "equals", values: ["marketing"] },
      },
    ],
  }),
  defineCollectionView("marketing-email", "Marketing email audience", {
    columns: ["name", "email", "marketingStatus", "emailPermission"],
    filters: [
      {
        id: "marketingStatus",
        value: { operator: "equals", values: ["marketing"] },
      },
      {
        id: "emailPermission",
        value: { operator: "equals", values: ["optedIn"] },
      },
      { id: "email", value: { operator: "notEmpty", values: [] } },
    ],
  }),
] as const
