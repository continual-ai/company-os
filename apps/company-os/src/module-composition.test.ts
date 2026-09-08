import { defineNotesModule } from "@company/notes/model"
import { defineModel, describeModel } from "@company/runtime"
import { expect, it } from "vitest"

import { Root } from "#/model-root.ts"
import { Actor } from "#/modules/access/interfaces/actor.ts"
import { AccessModule } from "#/modules/access/model.ts"
import { EngineeringModule } from "#/modules/engineering/model.ts"

it("composes Notes with Engineering without installing Sales", () => {
  const model = defineModel({
    name: "Engineering",
    root: Root,
    actor: Actor,
    modules: [AccessModule, defineNotesModule(Root), EngineeringModule],
  })
  const description = describeModel(model)
  expect(description.objects.map(({ id }) => id)).toEqual(
    expect.arrayContaining([
      "note",
      "issue",
      "project",
      "repository",
      "pullRequest",
    ])
  )
  for (const id of ["company", "contact", "deal"]) {
    expect(model.objects).not.toHaveProperty(id)
  }
  expect(description.relationships).toContainEqual(
    expect.objectContaining({
      id: "noteSubjects",
      reverse: expect.objectContaining({ key: "notes" }),
    })
  )
  expect(model.objects.issue.interfaces).toHaveProperty("noteSubject")
})
