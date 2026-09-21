import { Model } from "#/app.model.ts"
import { Contact } from "#/modules/crm/model/contact.ts"
import { defineCollectionView } from "#/runtime/ui/module.ts"

export const contactViews = [
  defineCollectionView(Model, Contact, "all", "All contacts", {
    columns: [
      "name",
      "affiliations.jobTitle",
      "relationshipStrength",
      "email",
      "phone",
    ],
  }),
  defineCollectionView(Model, Contact, "marketing", "Marketing contacts", {
    columns: ["name", "email", "marketingStatus", "emailPermission"],
    filters: [
      {
        id: "marketingStatus",
        value: { operator: "equals", values: ["marketing"] },
      },
    ],
  }),
  defineCollectionView(
    Model,
    Contact,
    "marketing-email",
    "Marketing email audience",
    {
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
    }
  ),
] as const
