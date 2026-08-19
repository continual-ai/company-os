import { afterAll, describe, expect, it } from "vitest"

import { defineAction } from "./definition/action"
import { defineCompany } from "./definition/company"
import { defineError } from "./definition/error"
import { field } from "./definition/field"
import { defineModule } from "./definition/module"
import { defineObject } from "./definition/object"
import { schema } from "./definition/schema"
import {
  compileCompanyHttpApi,
  makeCompanyApiReference,
  toOpenApiDocument,
} from "./effect-http"

const Account = defineObject({
  id: "account",
  collection: "accounts",
  name: "Account",
  pluralName: "Accounts",
  fields: {
    email: field.email(),
    externalId: field.text({ immutable: true, required: true }),
    logo: field.image({ nullable: true }),
    name: field.text({ required: true }),
    searchLabel: field.text({ outputOnly: true }),
    status: field.select({
      defaultValue: "active",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    }),
  },
  display: { title: "name" },
  operations: { delete: false },
})

const ArchiveFailed = defineError({
  code: "archiveFailed",
  category: "failedPrecondition",
  name: "Archive failed",
  details: schema.object({ reason: schema.string() }),
})

const ArchiveAccount = defineAction({
  id: "archiveAccount",
  verb: "archive",
  name: "Archive account",
  subject: Account,
  input: schema.object({ note: schema.optional(schema.string()) }),
  output: schema.object({ accountId: schema.recordId(Account) }),
  errors: [ArchiveFailed],
})

const Example = defineCompany({
  id: "example",
  name: "Example",
  modules: [
    defineModule({
      id: "crm",
      name: "CRM",
      objects: [Account],
      actions: [ArchiveAccount],
    }),
  ],
})

const api = compileCompanyHttpApi(Example)
const document = toOpenApiDocument(api)
const reference = makeCompanyApiReference(api)

afterAll(() => reference.dispose())

describe("Effect HTTP projection", () => {
  it("derives conventional object operations and honors opt-outs", () => {
    expect(document.openapi).toBe("3.1.0")
    expect(document.info).toMatchObject({
      title: "Example API",
      version: "1.0.0",
    })
    expect(document.paths["/api/v1/accounts"]).toMatchObject({
      get: { operationId: "listAccounts" },
      post: { operationId: "createAccount" },
    })
    expect(document.paths["/api/v1/accounts:batchGet"]).toMatchObject({
      post: { operationId: "batchGetAccounts" },
    })
    expect(document.paths["/api/v1/accounts/{accountId}"]).toMatchObject({
      get: { operationId: "getAccount" },
      patch: { operationId: "updateAccount" },
    })
    expect(
      document.paths["/api/v1/accounts/{accountId}"]?.delete
    ).toBeUndefined()
    expect(document.paths["/api/v1/accounts"]?.post?.parameters).toContainEqual(
      expect.objectContaining({ in: "header", name: "idempotency-key" })
    )
    expect(document.paths["/api/v1/accounts"]?.post?.responses).toHaveProperty(
      "422"
    )
    expect(document.components?.schemas.AccountList).toHaveProperty(
      "required",
      expect.arrayContaining(["items", "nextPageToken"])
    )
    expect(document.components?.schemas).toHaveProperty("NotFoundError")
    expect(document.components?.schemas).toHaveProperty("ValidationError")
    expect(document.components?.schemas).toHaveProperty("AccountStatus")
    expect(document.components?.schemas).toHaveProperty("AccountEmail")
    expect(document.components?.schemas).toHaveProperty("AccountLogo")
    expect(document.components?.schemas).toHaveProperty("Annotations")
    expect(document.components?.schemas).toHaveProperty("ImageRef")
    expect(document.components?.schemas).not.toHaveProperty(
      "AccountRecordNotFoundError"
    )
    expect(
      Object.keys(document.components?.schemas ?? {}).filter((name) =>
        name.startsWith("NotFoundError")
      )
    ).toEqual(["NotFoundError"])
    expect(document.components?.schemas).not.toHaveProperty("Account_1")
    expect(
      Object.keys(document.components?.schemas ?? {}).some((name) =>
        /^(Objects_|Union_)/.test(name)
      )
    ).toBe(false)

    const recordSchema = document.components?.schemas.Account
    const createSchema = document.components?.schemas.AccountCreateInput
    const updateSchema = document.components?.schemas.AccountUpdateInput
    expect(recordSchema).toHaveProperty("properties.email")
    expect(recordSchema).toHaveProperty("properties.logo")
    expect(recordSchema).toHaveProperty("properties.searchLabel")
    expect(recordSchema).toHaveProperty(
      "required",
      expect.arrayContaining(["email", "logo", "searchLabel"])
    )
    expect(JSON.stringify(document.components?.schemas.AccountLogo)).toContain(
      '"type":"null"'
    )
    expect(JSON.stringify(recordSchema)).toContain('"readOnly":true')
    expect(createSchema).toHaveProperty("properties.email")
    expect(createSchema).toHaveProperty("properties.logo")
    expect(createSchema).toHaveProperty("properties.externalId")
    expect(createSchema).not.toHaveProperty("properties.searchLabel")
    expect(JSON.stringify(createSchema)).not.toContain('"writeOnly":true')
    expect(updateSchema).toHaveProperty("properties.email")
    expect(updateSchema).toHaveProperty("properties.logo")
    expect(updateSchema).toHaveProperty("properties.externalId")
    expect(JSON.stringify(updateSchema)).toContain("Immutable after creation")
    expect(updateSchema).not.toHaveProperty("properties.searchLabel")
  })

  it("projects custom actions to AIP-style paths and declared errors", () => {
    const action = document.paths["/api/v1/accounts/{accountId}:archive"]?.post

    expect(action).toMatchObject({
      operationId: "archiveAccount",
      summary: "Archive account",
      responses: {
        "200": { description: "ArchiveAccountOutput" },
        "400": { description: "ArchiveFailedError" },
        "404": {
          description:
            "The requested resource does not exist or is not visible to the caller.",
        },
      },
    })
    expect(action?.parameters).toContainEqual(
      expect.objectContaining({ in: "path", name: "accountId", required: true })
    )
  })

  it("serves Effect's Scalar browser through a Fetch handler", async () => {
    const response = await reference.handler(
      new Request("http://localhost/api/docs")
    )
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(html).toContain("Scalar.createApiReference")
    expect(html).toContain("Example API")
  })
})
