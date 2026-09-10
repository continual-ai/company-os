import {
  defineModel,
  defineModule,
  defineObject,
  schema,
} from "#/runtime/model/index.ts"
import type { ClientRecord } from "#/runtime/ui/model/object-client.ts"

// This model belongs only to the gallery. It is never composed into app.model.ts or persisted.
export const ExampleProject = defineObject({
  id: "designProject",
  collection: "designProjects",
  name: "Project",
  pluralName: "Projects",
  description: "A local example for trying the application’s record controls.",
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 120 }),
    status: schema.select({
      label: "Status",
      default: "planned",
      options: [
        { value: "planned", label: "Planned" },
        { value: "active", label: "Active" },
        { value: "complete", label: "Complete" },
      ],
    }),
    score: schema.score({ label: "Score", nullable: true }),
    budget: schema.money({ label: "Budget", nullable: true }),
    startsOn: schema.date({ label: "Start date", nullable: true }),
    endsOn: schema.date({ label: "End date", nullable: true }),
    email: schema.email({ label: "Contact email", nullable: true }),
    description: schema.string({
      label: "Description",
      nullable: true,
      maxLength: 2000,
    }),
  },
  display: {
    title: "name",
    subtitle: "email",
    status: "status",
    icon: "folder",
  },
})

export const exampleModel = defineModel({
  name: "Design examples",
  modules: [
    defineModule({
      id: "designExamples",
      name: "Design examples",
      objects: [ExampleProject],
    }),
  ],
})

export const exampleRecords: ClientRecord[] = [
  {
    id: "design_project_one",
    etag: "preview",
    name: "Customer onboarding",
    status: "active",
    score: 92,
    budget: { amount: "52500", currency: "USD" },
    startsOn: "2026-09-07",
    endsOn: "2026-09-11",
    email: "team@example.com",
    description: "Review the rollout with the operations team.",
  },
  {
    id: "design_project_two",
    etag: "preview",
    name: "Partner workshop",
    status: "planned",
    score: 68,
    budget: { amount: "2400", currency: "EUR" },
    startsOn: "2026-09-14",
    endsOn: "2026-09-16",
    email: null,
    description: "Confirm attendees and prepare the agenda.",
  },
  {
    id: "design_project_three",
    etag: "preview",
    name: "Service review",
    status: "complete",
    score: null,
    budget: null,
    startsOn: "2026-09-01",
    endsOn: "2026-09-04",
    email: "review@example.com",
    description: null,
  },
]
