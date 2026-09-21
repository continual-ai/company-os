import { Ticket } from "#/modules/service/model/index.ts"
import { Task } from "#/modules/work/model/index.ts"
import { defineLink } from "#/runtime/model/index.ts"
export const TicketTasks = defineLink({
  id: "ticketTasks",
  name: "Customer reported tasks",
  from: { object: Ticket, key: "tasks", label: "Tasks", min: 0 },
  to: { object: Task, key: "tickets", label: "Customer tickets", min: 0 },
})
