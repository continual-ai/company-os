import { OpenApi } from "effect/unstable/httpapi"
import { expect, it } from "vitest"

import { applicationHttpApi } from "./http-api"

it("documents identity without losing generated colon methods or list parameters", () => {
  const spec = OpenApi.fromApi(applicationHttpApi)
  expect(spec.components.securitySchemes.runtimeIdentity).toMatchObject({
    type: "apiKey",
    in: "header",
    name: "x-continual-app-runtime-assertion",
  })
  expect(spec.paths["/api/v1/leads/{id}:convert"]?.post).toMatchObject({
    operationId: "convertLead",
    tags: ["Leads"],
    security: [{ runtimeIdentity: [] }],
  })
  expect(spec.paths["/api/v1/leads"]?.get).toMatchObject({
    security: [{ runtimeIdentity: [] }],
    parameters: expect.arrayContaining([
      expect.objectContaining({ name: "filter" }),
      expect.objectContaining({ name: "sort" }),
    ]),
  })
  expect(spec.paths["/api/v1/leads:search"]).toBeUndefined()
})
