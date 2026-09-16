import { Schema } from "effect"
import { expect, it } from "vitest"

import {
  toEffectInputSchema,
  toEffectOperationInput,
  schemaErrorViolations,
} from "#/runtime/contract/schema.ts"
import {
  defineAction,
  defineEvent,
  defineObject,
  defineQuery,
  schema,
} from "#/runtime/model/index.ts"

const Object = defineObject({
  id: "secretTest",
  collection: "secretTests",
  name: "Test",
  pluralName: "Tests",
  properties: { name: schema.string() },
  display: { title: "name" },
})

it("validates discriminated unions and rejects ambiguous tags", () => {
  expect(() =>
    schema.discriminatedUnion("type", [
      schema.object({ type: schema.literal("same") }),
      schema.object({ type: schema.literal("same") }),
    ])
  ).toThrow("unique")
  expect(() =>
    schema.discriminatedUnion("type", [
      schema.object({ type: schema.string() }),
    ])
  ).toThrow("literal")
  const config = schema.discriminatedUnion("type", [
    schema.object({ type: schema.literal("key"), label: schema.string() }),
    schema.object({ type: schema.literal("oauth"), url: schema.url() }),
  ])
  expect(() =>
    Schema.decodeUnknownSync(toEffectInputSchema(config))({
      type: "oauth",
      label: "wrong",
    })
  ).toThrow()
})

it("allows stored secrets and explicit action outputs, but rejects query and event secrets", () => {
  const nested = schema.object({ credential: schema.array(schema.secret()) })
  expect(() =>
    defineObject({
      id: "invalidSecret",
      collection: "invalidSecrets",
      name: "Invalid",
      pluralName: "Invalid",
      properties: { name: schema.string(), nested },
      display: { title: "name" },
    })
  ).not.toThrow()
  expect(() =>
    defineAction({
      id: "leak",
      name: "Leak",
      description: "",
      output: { nested },
    })
  ).not.toThrow()
  expect(() =>
    defineQuery({
      id: "leak",
      name: "Leak",
      description: "",
      input: { nested },
    })
  ).toThrow("cannot contain secrets")
  expect(() =>
    defineEvent({
      type: "secretTest.leak",
      version: 1,
      subject: Object,
      data: nested,
    })
  ).toThrow("cannot contain secrets")
})

it("omits rejected secret values from validation messages and issue serialization", () => {
  const input = schema.object({
    nested: schema.object({ key: schema.secret({ minLength: 30 }) }),
  })
  const codec = toEffectOperationInput(input)
  try {
    Schema.decodeUnknownSync(codec)({ nested: { key: "private-value" } })
    expect.fail("should reject")
  } catch (error) {
    if (!Schema.isSchemaError(error)) throw error
    expect(error.message).not.toContain("private-value")
    expect(JSON.stringify(error)).not.toContain("private-value")
    expect(JSON.stringify(schemaErrorViolations(error))).not.toContain(
      "private-value"
    )
  }
  const secret = toEffectInputSchema(schema.secret())
  const json = JSON.stringify(
    Schema.toStandardJSONSchemaV1(secret)["~standard"].jsonSchema.input({
      target: "draft-2020-12",
    })
  )
  expect(json).toContain('"writeOnly":true')
  expect(json).toContain('"format":"password"')
})

it("rejects defaults on containers holding secrets", () => {
  expect(() =>
    defineAction({
      id: "defaultLeak",
      name: "Default leak",
      description: "",
      input: {
        credentials: schema.object(
          { key: schema.secret() },
          { default: { key: "default-secret" } }
        ),
      },
    })
  ).toThrow("Schema defaults")
})
