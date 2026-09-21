import {
  Feedback,
  FeedbackOwner,
  FeedbackReporter,
  FeedbackTasks,
  FeedbackTickets,
} from "#/modules/feedback/model/feedback.ts"
import { TicketTasks } from "#/modules/feedback/model/ticket-tasks.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const FeedbackModule = defineModule({
  id: "feedback",
  name: "Feedback",
  description:
    "Collect observations and requests, review their evidence, and connect them to work.",
  maturity: "alpha",
  objects: [Feedback],
  links: [
    FeedbackOwner,
    FeedbackReporter,
    FeedbackTasks,
    FeedbackTickets,
    TicketTasks,
  ],
})

export { Feedback }
