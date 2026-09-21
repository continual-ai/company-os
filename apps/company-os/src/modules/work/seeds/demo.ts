import { DateTime, Effect } from "effect"

import { Task, Project } from "#/modules/work/model/index.ts"
import type { RecordId } from "#/runtime/model/index.ts"
import { CalendarDate } from "#/runtime/model/index.ts"
import { Note } from "#/runtime/platform/model/note.ts"
import { Database } from "#/runtime/server/index.ts"
import { linkSeedRecords } from "#/runtime/server/seeds.ts"

export const seedWorkDemo = Effect.fn("@company/seedWorkDemo")(function* ({
  owner,
}: {
  readonly owner: RecordId<"user">
}) {
  const records = yield* Database
  const services = {
    project: records.repository(Project),
    task: records.repository(Task),
    note: records.repository(Note),
  }
  const project = yield* services.project.create({
    name: "Customer onboarding",
    objective: "Make account setup reliable for every new customer.",
    status: "active",
    links: { owner: owner },
  })
  const tasks = yield* Effect.forEach(
    [
      ["Recover expired invitations", "inProgress", "high"],
      ["Show import progress for large contact lists", "planned", "normal"],
      ["Preserve filters when returning from a record", "done", "normal"],
    ] as const,
    ([title, status, priority]) =>
      services.task.create({
        title,
        status,
        priority,
        description:
          "Reported during Northstar's pilot. Keep the user in context and make the next step clear.",
        links: { project: project.id, owner: owner },
      })
  )
  const note = yield* services.note.create({
    content:
      "### Recovery behavior\n\nKeep the original invitation context. Let the user request a fresh link without starting over.\n\n```text\nexpired → request new link → resume onboarding\n```",
  })
  yield* linkSeedRecords(Note, "subjects", note.id, tasks[0].id)
  const now = yield* DateTime.now
  const date = (days: number) =>
    CalendarDate(DateTime.formatIso(DateTime.add(now, { days })).slice(0, 10))
  const installation = yield* services.project.create({
    name: "Workshop electrical upgrade",
    objective:
      "Commission the new assembly area with an accepted installation and handover record.",
    status: "active",
    targetDate: date(21),
    links: { owner },
  })
  const packageTask = yield* services.task.create({
    title: "Deliver the electrical installation",
    status: "inProgress",
    acceptanceCriteria:
      "Approved drawings, installed equipment, and a signed acceptance report are attached.",
    plannedStartDate: date(-3),
    plannedFinishDate: date(21),
    dueDate: date(21),
    links: { project: installation.id, owner },
  })
  const design = yield* services.task.create({
    title: "Approve the panel design",
    status: "done",
    acceptanceCriteria:
      "The engineering reviewer accepts a specific drawing revision.",
    plannedStartDate: date(-3),
    plannedFinishDate: date(-1),
    links: { project: installation.id, parent: packageTask.id, owner },
  })
  const procure = yield* services.task.create({
    title: "Procure the distribution panels",
    status: "planned",
    acceptanceCriteria:
      "Required panels have been received and checked against the approved design.",
    plannedStartDate: date(0),
    plannedFinishDate: date(10),
    dueDate: date(10),
    links: {
      project: installation.id,
      parent: packageTask.id,
      owner,
      dependsOn: [design.id],
    },
  })
  const install = yield* services.task.create({
    title: "Install and commission the panels",
    status: "planned",
    plannedStartDate: date(11),
    plannedFinishDate: date(21),
    dueDate: date(21),
    links: {
      project: installation.id,
      parent: packageTask.id,
      owner,
      dependsOn: [procure.id],
    },
  })
  yield* services.task.create({
    title: "Prepare the commissioning checklist",
    status: "planned",
    acceptanceCriteria:
      "The checklist identifies each required test and the evidence to capture.",
    plannedStartDate: date(0),
    plannedFinishDate: date(2),
    links: {
      project: installation.id,
      parent: install.id,
      owner,
      dependsOn: [design.id],
    },
  })
  yield* services.task.create({
    title: "Review this week's maintenance exceptions",
    status: "planned",
    acceptanceCriteria:
      "Each exception has a documented resolution or an accountable owner and next step.",
    dueDate: date(3),
    links: { owner },
  })
  return { project, tasks, owner }
})
