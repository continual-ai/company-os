import { Schema } from "effect"
import { describe, expect, it } from "vitest"

import {
  httpOperation,
  httpOperationInput,
  httpOperationRequest,
} from "#/runtime/contract/http-operation.ts"
import {
  modelOperation,
  operationContracts,
} from "#/runtime/contract/operation-contract.ts"
import {
  defineLink,
  defineModel,
  defineModule,
  defineObject,
  schema,
  defineAction,
} from "#/runtime/model/index.ts"

const Account = defineObject({
  id: "account",
  collection: "accounts",
  name: "Account",
  pluralName: "Accounts",
  properties: { name: schema.string() },
  display: { title: "name" },
})
const Contact = defineObject({
  id: "contact",
  collection: "contacts",
  name: "Contact",
  pluralName: "Contacts",
  properties: {
    name: schema.string({ minLength: 1 }),
    status: schema.string({ default: "new" }),
    computed: schema.string({ outputOnly: true, nullable: true }),
  },
  display: { title: "name" },
})
const ContactEnroll = defineAction({
  id: "enroll",
  record: Contact,
  name: "Enroll",
  description: "Enrolls a contact.",
  input: { id: schema.id(Contact), notify: schema.optional(schema.boolean()) },
  output: { enrolled: schema.boolean() },
})
const Membership = defineLink({
  id: "membership",
  name: "Membership",
  from: { object: Contact, key: "account", label: "Account", min: 1, max: 1 },
  to: { object: Account, key: "contacts", label: "Contacts" },
})
const Assignment = defineLink({
  id: "assignment",
  name: "Assignment",
  outputOnly: true,
  from: {
    object: Contact,
    key: "assignedAccount",
    label: "Assigned account",
    max: 1,
  },
  to: { object: Account, key: "assignedContacts", label: "Assigned contacts" },
})
const model = defineModel({
  name: "Contracts",
  modules: [
    defineModule({
      id: "contacts",
      name: "Contacts",
      objects: [Account, Contact],
      interfaces: [],
      links: [Membership, Assignment],
      actions: [ContactEnroll],
    }),
  ],
})

const decode = (key: string, input: unknown) =>
  Schema.decodeUnknownSync(modelOperation(model, key).input)(input)

describe("resolved operation contracts", () => {
  it("uses record scope for individual records and Link traversals, and object scope for sets", () => {
    for (const key of [
      "contact.get",
      "contact.update",
      "contact.delete",
      "contact.enroll",
      "contact.account.get",
      "account.contacts.list",
    ]) {
      const operation = modelOperation(model, key)
      expect(operation.scope).toBe("record")
      expect(Object.keys(httpOperation(operation).params.fields)).toEqual([
        "id",
      ])
    }
    for (const key of [
      "contact.create",
      "contact.list",
      "contact.batchGet",
      "contact.batchDelete",
    ]) {
      const operation = modelOperation(model, key)
      expect(operation.scope).toBe("object")
      expect(Object.keys(httpOperation(operation).params.fields)).toEqual([])
    }
  })

  it("resolves standard mutations against required, bounded, and output-only Links", () => {
    const input = { name: "Ada", links: { account: "acme" } }
    expect(decode("contact.create", input)).toEqual(input)
    for (const links of [
      undefined,
      {},
      { account: null },
      { account: ["acme", "other"] },
    ]) {
      expect(() => decode("contact.create", { name: "Ada", links })).toThrow()
    }
    const create = modelOperation(model, "contact.create").input
    expect(create.fields).not.toHaveProperty("computed")
    const json = Schema.toStandardJSONSchemaV1(create)[
      "~standard"
    ].jsonSchema.input({ target: "draft-2020-12" })
    expect(JSON.stringify(json)).not.toContain("assignedAccount")
    expect(operationContracts(model).map(({ key }) => key)).toContain(
      "contact.assignedAccount.get"
    )
    expect(operationContracts(model).map(({ key }) => key)).not.toContain(
      "contact.assignedAccount.link"
    )

    expect(
      decode("contact.update", { id: "ada", name: "Ada Lovelace" })
    ).toEqual({ id: "ada", name: "Ada Lovelace" })
    const update = { id: "ada", links: { account: "other" } }
    expect(decode("contact.update", update)).toEqual(update)
    expect(decode("contact.delete", { id: "ada" })).toEqual({ id: "ada" })
    expect(() => decode("contact.batchDelete", { ids: [] })).toThrow()
    expect(() =>
      decode("contact.batchDelete", {
        ids: Array.from({ length: 101 }, () => "ada"),
      })
    ).toThrow()
  })

  it("preserves optional custom inputs and keeps resolution isolated to each composed model", () => {
    expect(decode("contact.enroll", { id: "ada" })).toEqual({ id: "ada" })
    expect(decode("contact.enroll", { id: "ada", notify: false })).toEqual({
      id: "ada",
      notify: false,
    })
    expect(() => decode("contact.enroll", { notify: true })).toThrow()
    const unlinked = defineModel({
      name: "Unlinked",
      modules: [
        defineModule({
          id: "contacts",
          name: "Contacts",
          objects: [Account, Contact],
          interfaces: [],
          links: [],
          actions: [ContactEnroll],
        }),
      ],
    })
    expect(
      Schema.decodeUnknownSync(
        modelOperation(unlinked, "contact.create").input
      )({ name: "Ada" })
    ).toEqual({ name: "Ada" })
    expect(() => decode("contact.create", { name: "Ada" })).toThrow()
    expect(modelOperation(model, "contact.create")).toBe(
      modelOperation(model, "contact.create")
    )
  })

  it("round trips canonical inputs through HTTP field placement and JSON query encoding", () => {
    const inputs = [
      [
        "contact.list",
        {
          filter: { field: "name", operator: "eq", value: "Ada" },
          sort: [{ field: "name", direction: "asc" }],
        },
      ],
      [
        "account.contacts.list",
        { id: "acme", filter: { field: "name", operator: "eq", value: "Ada" } },
      ],
      ["contact.update", { id: "ada", name: "Ada Lovelace" }],
      ["contact.delete", { id: "ada", etag: "current" }],
      ["contact.enroll", { id: "ada", notify: false }],
    ] as const
    for (const [key, input] of inputs) {
      const http = httpOperation(modelOperation(model, key))
      const request = httpOperationRequest(http, input)
      const wire = Schema.encodeSync(http.input)(
        request[http.inputLocation] ?? {}
      )
      expect(
        httpOperationInput(http, {
          params: request.params,
          [http.inputLocation]: Schema.decodeUnknownSync(http.input)(wire),
        })
      ).toEqual(input)
    }
  })
})
