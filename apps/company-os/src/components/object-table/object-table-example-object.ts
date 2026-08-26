import { defineObject, defineRoot, schema } from "@company/runtime"

const Root = defineRoot({ id: "root", name: "Root" })

export const ObjectTableExampleCompany = defineObject({
  id: "objectTableExampleCompany",
  collection: "objectTableExampleCompanies",
  name: "Company",
  parent: Root,
  pluralName: "Companies",
  properties: {
    logo: schema.image({ label: "Logo", aspectRatio: 1, nullable: true }),
    name: schema.string({ label: "Name", maxLength: 200 }),
    categories: schema.array(
      schema.select({
        options: [
          { value: "B2B", label: "B2B", color: "yellow" },
          { value: "B2C", label: "B2C", color: "lime" },
          {
            value: "Distribution",
            label: "Distribution",
            color: "cyan",
          },
          {
            value: "Logistics",
            label: "Logistics",
            color: "blue",
            icon: "truck",
          },
          { value: "Enterprise", label: "Enterprise", color: "purple" },
          {
            value: "Manufacturing",
            label: "Manufacturing",
            color: "orange",
            icon: "factory",
          },
          {
            value: "Industrial technology",
            label: "Industrial technology",
            color: "indigo",
          },
          {
            value: "Consumer goods",
            label: "Consumer goods",
            color: "pink",
          },
          {
            value: "Retail",
            label: "Retail",
            color: "green",
            icon: "shoppingBag",
          },
        ],
      }),
      {
        label: "Categories",
        default: [],
      }
    ),
    domain: schema.domain({ label: "Domain", nullable: true }),
    website: schema.url({ label: "Website", nullable: true }),
    linkedIn: schema.url({ label: "LinkedIn", nullable: true }),
    industry: schema.string({ label: "Industry", nullable: true }),
    description: schema.string({
      label: "Description",
      maxLength: 2_000,
      nullable: true,
    }),
    employeeCount: schema.number({
      label: "Employees",
      integer: true,
      minimum: 0,
      nullable: true,
    }),
    foundedOn: schema.date({ label: "Founded", nullable: true }),
    lastReviewedAt: schema.timestamp({
      label: "Last reviewed",
      nullable: true,
    }),
    strategic: schema.boolean({ label: "Strategic", default: false }),
    contactEmail: schema.email({ label: "Contact email", nullable: true }),
    contactPhone: schema.phone({ label: "Contact phone", nullable: true }),
    lifecycleStage: schema.select({
      label: "Lifecycle stage",
      default: "prospect",
      options: [
        { value: "prospect", label: "Prospect" },
        { value: "customer", label: "Customer" },
        { value: "inactive", label: "Inactive" },
      ],
    }),
  },
  display: {
    icon: "building",
    image: "logo",
    title: "name",
    subtitle: "domain",
    status: "lifecycleStage",
  },
})

export const objectTableExampleVisiblePropertyIds = [
  "name",
  "logo",
  "categories",
  "description",
  "employeeCount",
  "foundedOn",
  "lastReviewedAt",
  "strategic",
  "domain",
  "website",
  "linkedIn",
  "contactEmail",
  "contactPhone",
  "lifecycleStage",
] as const
