import { expect, it } from "vitest"

import { EngineeringModule } from "#/modules/engineering/model/index.ts"
import { NotesModule } from "#/modules/notes/model/index.ts"
import { AccessModule } from "#/runtime/access/model/index.ts"
import { defineModel, describeModel } from "#/runtime/model/index.ts"

it("composes Notes with Engineering without installing Sales", () => {
  const model = defineModel({
    name: "Engineering",
    modules: [AccessModule, NotesModule, EngineeringModule],
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
