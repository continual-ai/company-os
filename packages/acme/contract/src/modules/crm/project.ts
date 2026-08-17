import { date, defineObject, link, select, text } from "@continual/runtime"

import { Customer } from "./customer"

export const Project = defineObject({
  id: "project",
  name: "Project",
  pluralName: "Projects",
  description: "A prospective or active piece of customer work.",
  fields: {
    customerId: link({ object: Customer, required: true }),
    name: text({ required: true }),
    workType: select({
      required: true,
      options: [
        { value: "undetermined", label: "Undetermined" },
        { value: "advisory", label: "Advisory" },
        { value: "implementation", label: "Implementation" },
        { value: "support", label: "Support" },
        { value: "other", label: "Other" },
      ],
    }),
    status: select({
      required: true,
      options: [
        { value: "inquiry", label: "Inquiry" },
        { value: "proposal", label: "Proposal" },
        { value: "active", label: "Active" },
        { value: "onHold", label: "On hold" },
        { value: "complete", label: "Complete" },
        { value: "archived", label: "Archived" },
      ],
    }),
    startsOn: date(),
    endsOn: date(),
  },
  display: {
    title: "name",
    subtitle: "workType",
    status: "status",
  },
})
