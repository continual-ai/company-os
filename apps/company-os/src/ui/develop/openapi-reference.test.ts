import { describe, expect, it } from "vitest"

import {
  curlExample,
  exampleForSchema,
  filterOperations,
  operationKey,
  operationsFromDocument,
  type OpenApiDocument,
} from "./openapi-reference-model"

const document: OpenApiDocument = {
  info: { title: "Example API", version: "1.0.0" },
  openapi: "3.1.0",
  paths: {
    "/api/v1/companies": {
      get: {
        operationId: "listCompanies",
        summary: "List companies",
        tags: ["Companies"],
      },
      post: {
        operationId: "createCompany",
        summary: "Create company",
        tags: ["Companies"],
      },
    },
    "/health": {
      get: { summary: "Health check" },
    },
  },
}

describe("OpenAPI reference projection", () => {
  it("projects HTTP methods into stable operation entries", () => {
    expect(operationsFromDocument(document)).toEqual([
      expect.objectContaining({
        method: "get",
        operationId: "listCompanies",
        path: "/api/v1/companies",
        tag: "Companies",
      }),
      expect.objectContaining({
        method: "post",
        operationId: "createCompany",
        path: "/api/v1/companies",
        tag: "Companies",
      }),
      expect.objectContaining({
        method: "get",
        path: "/health",
        tag: "Other",
      }),
    ])
  })

  it("searches across operation meaning and transport details", () => {
    const operations = operationsFromDocument(document)
    expect(filterOperations(operations, "create")).toHaveLength(1)
    expect(filterOperations(operations, "/health")).toHaveLength(1)
    expect(filterOperations(operations, "companies")).toHaveLength(2)
  })

  it("builds stable deep-link keys and useful request examples", () => {
    const operation = operationsFromDocument(document)[1]
    expect(operation).toBeDefined()
    if (operation === undefined) return

    expect(operationKey(operation)).toBe("createCompany")
    expect(
      exampleForSchema(
        { $ref: "#/components/schemas/CreateCompany" },
        {
          CreateCompany: {
            type: "object",
            properties: {
              name: { type: "string" },
              note: { type: "string" },
            },
            required: ["name"],
          },
        }
      )
    ).toEqual({ name: "string" })
    expect(curlExample(operation, {})).toContain(
      "curl -X POST '/api/v1/companies'"
    )
  })
})
