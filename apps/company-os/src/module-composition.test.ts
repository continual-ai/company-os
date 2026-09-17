import { expect, it } from "vitest"

import { EngineeringModule } from "#/modules/engineering/model/index.ts"
import { ProductModule } from "#/modules/product/model/index.ts"
import { defineModel, describeModel } from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"

it("composes Notes with Engineering without installing Sales", () => {
  const model = defineModel({
    name: "Engineering",
    modules: [PlatformModule, ProductModule, EngineeringModule],
  })
  const description = describeModel(model)
  expect(description.objects.map(({ id }) => id)).toEqual(
    expect.arrayContaining([
      "note",
      "issue",
      "project",
      "connection",
      "githubRepository",
      "githubIssue",
      "githubPullRequest",
    ])
  )
  for (const id of ["account", "contact", "opportunity"]) {
    expect(model.objects).not.toHaveProperty(id)
  }
  expect(description.links).toContainEqual(
    expect.objectContaining({
      id: "noteSubjects",
      reverse: expect.objectContaining({ key: "notes" }),
    })
  )
  expect(model.objects.issue.interfaces).toHaveProperty("noteSubject")
})
