import type { ObjectCollectionView } from "@/ui/model/object-collection-view"

function view(
  id: string,
  label: string,
  options: {
    readonly columns: ReadonlyArray<string>
    readonly filters?: ObjectCollectionView["state"]["filters"]
    readonly sorting?: ObjectCollectionView["state"]["sorting"]
  }
): ObjectCollectionView {
  return {
    id,
    label,
    state: {
      filters: options.filters ?? [],
      sorting: options.sorting ?? [],
      visibility: Object.fromEntries(
        options.columns.map((column) => [column, true])
      ),
    },
  }
}

export const companyViews = [
  view("all", "All companies", {
    columns: ["name", "domain", "industry", "lifecycleStage"],
    sorting: [{ id: "name", desc: false }],
  }),
  view("prospects", "Prospects", {
    columns: ["name", "domain", "industry", "lifecycleStage"],
    filters: [
      {
        id: "lifecycleStage",
        value: { operator: "equals", values: ["prospect"] },
      },
    ],
    sorting: [{ id: "name", desc: false }],
  }),
  view("customers", "Customers", {
    columns: ["name", "domain", "website", "industry", "lifecycleStage"],
    filters: [
      {
        id: "lifecycleStage",
        value: { operator: "equals", values: ["customer"] },
      },
    ],
    sorting: [{ id: "name", desc: false }],
  }),
] as const

export const contactViews = [
  view("all", "All contacts", {
    columns: ["name", "jobTitle", "email", "phone"],
    sorting: [{ id: "name", desc: false }],
  }),
] as const

export const dealViews = [
  view("all", "All deals", {
    columns: ["name", "parent", "stage", "amount", "expectedCloseDate"],
    sorting: [{ id: "expectedCloseDate", desc: false }],
  }),
  view("open", "Open deals", {
    columns: ["name", "parent", "stage", "amount", "expectedCloseDate"],
    filters: [
      {
        id: "stage",
        value: {
          operator: "equals",
          values: ["discovery", "qualified", "proposal", "negotiation"],
        },
      },
    ],
    sorting: [{ id: "expectedCloseDate", desc: false }],
  }),
  view("won", "Won", {
    columns: ["name", "parent", "amount", "expectedCloseDate", "stage"],
    filters: [{ id: "stage", value: { operator: "equals", values: ["won"] } }],
    sorting: [{ id: "expectedCloseDate", desc: true }],
  }),
] as const

export const leadViews = [
  view("all", "All leads", {
    columns: ["name", "companyName", "email", "phone", "source", "status"],
    sorting: [{ id: "name", desc: false }],
  }),
  view("new", "New", {
    columns: ["name", "companyName", "email", "phone", "source", "status"],
    filters: [{ id: "status", value: { operator: "equals", values: ["new"] } }],
    sorting: [{ id: "name", desc: false }],
  }),
  view("qualified", "Qualified", {
    columns: ["name", "companyName", "email", "phone", "source", "status"],
    filters: [
      {
        id: "status",
        value: { operator: "equals", values: ["qualified"] },
      },
    ],
    sorting: [{ id: "name", desc: false }],
  }),
] as const

export const noteViews = [
  view("all", "All notes", {
    columns: ["content"],
  }),
] as const
