import { OpenApi } from "effect/unstable/httpapi"
import { afterAll, describe, expect, it } from "vitest"

import { defineError } from "./definition/error"
import { defineInterface } from "./definition/interface"
import { defineModel } from "./definition/model"
import { defineObject } from "./definition/object"
import { defineRoot } from "./definition/root"
import { schema } from "./definition/schema"
import { createApiReference, createHttpApi } from "./effect-http"

const ArchiveFailed = defineError({
  code: "archiveFailed",
  category: "failedPrecondition",
  name: "Archive failed",
  details: schema.object({ reason: schema.string() }),
})

const Identity = defineInterface({
  id: "identity",
  name: "Identity",
  pluralName: "Identities",
})
const Platform = defineRoot({
  id: "platform",
  implements: [{ interface: Identity }],
  name: "Platform",
})

const Account = defineObject({
  id: "account",
  collection: "accounts",
  name: "Account",
  parent: Platform,
  pluralName: "Accounts",
  properties: {
    email: schema.email(),
    externalId: schema.string({ immutable: true }),
    logo: schema.image({ nullable: true }),
    name: schema.string(),
    status: schema.select({
      default: "active",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    }),
  },
  display: { title: "name" },
  actions: {
    delete: false,
    archive: {
      scope: "object",
      name: "Archive account",
      description: "Archives an account.",
      input: { note: schema.optional(schema.string()) },
      output: { archived: schema.boolean() },
      errors: [ArchiveFailed],
      http: { path: "/accounts/{id}:archive" },
    },
    archiveAll: {
      scope: "collection",
      name: "Archive all accounts",
      description: "Archives every eligible account.",
      output: { archivedCount: schema.number({ integer: true }) },
      http: { path: "/accounts:archiveAll" },
    },
  },
})

const Example = defineModel({
  actor: Identity,
  id: "example",
  interfaces: [Identity],
  name: "Example",
  objects: [Account],
  links: [],
  root: Platform,
})

const httpApi = createHttpApi(Example)
const document = OpenApi.fromApi(httpApi)
const reference = createApiReference(httpApi)

afterAll(() => reference.dispose())

describe("Effect HTTP projection", () => {
  it("projects object reads and actions while honoring action opt-outs", () => {
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
    expect(document.paths["/api/v1/accounts:batchDelete"]).toBeUndefined()
    expect(document.paths["/api/v1/accounts:archiveAll"]).toMatchObject({
      post: { operationId: "archiveAllAccounts" },
    })
    expect(document.paths["/api/v1/accounts:search"]).toMatchObject({
      post: { operationId: "searchAccounts" },
    })
    expect(document.paths["/api/v1/accounts/{id}"]).toMatchObject({
      get: { operationId: "getAccount" },
      patch: { operationId: "updateAccount" },
    })
    expect(document.paths["/api/v1/accounts/{id}"]?.delete).toBeUndefined()
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
    expect(document.components?.schemas).toHaveProperty("RecordMetadata")
    expect(document.components?.schemas).toHaveProperty("ImageRef")
    expect(document.components?.schemas).toHaveProperty("RecordAliases")
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
      Object.keys(document.components?.schemas ?? {}).filter((name) =>
        /^(Objects_|Union_)/.test(name)
      )
    ).toEqual([])

    const recordSchema = document.components?.schemas.Account
    const createSchema = document.components?.schemas.AccountCreateInput
    const updateSchema = document.components?.schemas.AccountUpdateInput
    expect(recordSchema).toHaveProperty("properties.email")
    expect(recordSchema).toHaveProperty("properties.aliases")
    expect(recordSchema).toHaveProperty("properties.createdBy")
    expect(recordSchema).toHaveProperty("properties.logo")
    expect(recordSchema).toHaveProperty("properties.metadata")
    expect(recordSchema).toHaveProperty("properties.parent")
    expect(recordSchema).toHaveProperty("properties.updatedBy")
    expect(recordSchema).not.toHaveProperty("properties.createdById")
    expect(recordSchema).not.toHaveProperty("properties.parentId")
    expect(recordSchema).not.toHaveProperty("properties.updatedById")
    expect(recordSchema).toHaveProperty(
      "required",
      expect.arrayContaining(["aliases", "email", "logo"])
    )
    expect(JSON.stringify(document.components?.schemas.AccountLogo)).toContain(
      '"type":"null"'
    )
    expect(JSON.stringify(recordSchema)).toContain('"readOnly":true')
    expect(createSchema).toHaveProperty("properties.email")
    expect(createSchema).toHaveProperty("properties.aliases")
    expect(createSchema).toHaveProperty("properties.logo")
    expect(createSchema).toHaveProperty("properties.externalId")
    expect(createSchema).not.toHaveProperty("properties.parent")
    expect(JSON.stringify(createSchema)).not.toContain('"writeOnly":true')
    expect(updateSchema).toHaveProperty("properties.email")
    expect(updateSchema).toHaveProperty("properties.aliases")
    expect(updateSchema).toHaveProperty("properties.etag")
    expect(updateSchema).toHaveProperty("properties.logo")
    expect(updateSchema).toHaveProperty("properties.externalId")
    expect(JSON.stringify(updateSchema)).toContain("Immutable after creation")
    expect(JSON.stringify(updateSchema)).toContain('"add"')
    expect(JSON.stringify(updateSchema)).toContain('"remove"')
  })

  it("projects atomic batch delete when standard deletion is enabled", () => {
    const Deletable = defineObject({
      id: "deletable",
      collection: "deletables",
      name: "Deletable",
      parent: Platform,
      pluralName: "Deletables",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const model = defineModel({
      actor: Identity,
      id: "batchDeleteExample",
      interfaces: [Identity],
      name: "Batch delete example",
      objects: [Deletable],
      links: [],
      root: Platform,
    })
    const batchDocument = OpenApi.fromApi(createHttpApi(model))

    expect(batchDocument.paths["/api/v1/deletables:batchDelete"]).toMatchObject(
      {
        post: {
          operationId: "batchDeleteDeletables",
          responses: { "204": expect.any(Object) },
        },
      }
    )
    expect(
      batchDocument.components?.schemas.DeletableBatchDeleteInput
    ).toMatchObject({
      properties: {
        ids: { type: "array" },
      },
      required: ["ids"],
    })
    expect(
      batchDocument.paths["/api/v1/deletables/{id}"]?.delete?.parameters
    ).toContainEqual(
      expect.objectContaining({ in: "query", name: "etag", required: false })
    )
  })

  it("projects business actions to AIP-style paths and declared errors", () => {
    const action = document.paths["/api/v1/accounts/{id}:archive"]?.post

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
      expect.objectContaining({ in: "path", name: "id", required: true })
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
