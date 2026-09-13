import { describe, expect, it } from "vitest"

import {
  curlExample,
  exampleForSchema,
  filterOperations,
  operationKey,
  operationsFromDocument,
  type OpenApiDocument,
} from "#/app/ui/developer/openapi-reference-model.ts"

const document: OpenApiDocument = {
  info: { title: "Example API", version: "1.0.0" },
  openapi: "3.1.0",
  paths: {
    "/api/v1/accounts": {
      get: {
        operationId: "listAccounts",
        summary: "List accounts",
        tags: ["Accounts"],
      },
      post: {
        operationId: "createAccount",
        summary: "Create account",
        tags: ["Accounts"],
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
        operationId: "listAccounts",
        path: "/api/v1/accounts",
        tag: "Accounts",
      }),
      expect.objectContaining({
        method: "post",
        operationId: "createAccount",
        path: "/api/v1/accounts",
        tag: "Accounts",
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
    expect(filterOperations(operations, "accounts")).toHaveLength(2)
  })

  it("builds stable deep-link keys and useful request examples", () => {
    const operation = operationsFromDocument(document)[1]
    expect(operation).toBeDefined()
    if (operation === undefined) return

    expect(operationKey(operation)).toBe("createAccount")
    expect(
      exampleForSchema(
        { $ref: "#/components/schemas/CreateAccount" },
        {
          CreateAccount: {
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
      "curl -X POST '/api/v1/accounts'"
    )
  })
})
