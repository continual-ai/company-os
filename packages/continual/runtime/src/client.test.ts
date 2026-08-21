import { describe, expect, expectTypeOf, it } from "vitest"

import { ApiClientResponseError, createClient, type ApiClient } from "./client"
import { defineModel } from "./definition/model"
import { defineObject } from "./definition/object"
import { Root } from "./definition/root"
import { schema, type RecordId } from "./definition/schema"

const Account = defineObject({
  id: "account",
  collection: "accounts",
  name: "Account",
  parent: Root,
  pluralName: "Accounts",
  properties: {
    name: schema.string(),
  },
  display: { title: "name" },
  actions: {
    delete: false,
    archive: {
      scope: "object",
      name: "Archive account",
      description: "Archives an account.",
      input: {
        note: schema.optional(schema.string()),
      },
      output: {
        archived: schema.boolean(),
      },
      http: { path: "/accounts/{id}:archive" },
    },
    archiveAll: {
      scope: "collection",
      name: "Archive old accounts",
      description: "Archives accounts matching a filter.",
      input: { filter: schema.string() },
      output: { archivedCount: schema.number({ integer: true }) },
      http: { path: "/accounts:archiveAll" },
    },
  },
})

const Example = defineModel({
  id: "example",
  name: "Example",
  objects: [Account],
  links: [],
})

const accountRecord = {
  annotations: {},
  createdAt: "2026-08-18T18:00:00Z",
  createdById: "user-1",
  etag: "etag-1",
  id: "account/1",
  name: "Acme",
  parentId: "root_1",
  updatedAt: "2026-08-18T18:00:00Z",
  updatedById: "user-1",
}

function responseBody(url: string) {
  if (url.endsWith(":archiveAll")) return { archivedCount: 3 }
  if (url.endsWith(":archive")) return { archived: true }
  if (url.endsWith(":batchGet")) return { items: [accountRecord] }
  if (url.endsWith("/search")) {
    return { items: [accountRecord], nextPageToken: "" }
  }
  if (url.includes("?")) {
    return { items: [accountRecord], nextPageToken: "" }
  }
  return accountRecord
}

describe("inferred API client", () => {
  it("uses one input object for every object method", async () => {
    const calls: Array<{ init: RequestInit; url: string }> = []
    const fetchRequest: typeof globalThis.fetch = async (input, init) => {
      const url = new Request(input).url
      calls.push({ init: init ?? {}, url })
      return new Response(JSON.stringify(responseBody(url)), {
        headers: { "content-type": "application/json" },
      })
    }
    const client = createClient(Example, {
      baseUrl: "https://company.example/api/v1/",
      fetch: fetchRequest,
    })

    expect(Object.keys(client)).toEqual(["accounts"])
    expect(Object.keys(client.accounts)).toEqual([
      "list",
      "batchGet",
      "create",
      "get",
      "update",
      "archive",
      "archiveAll",
    ])

    const created = await client.accounts.create({ name: "Acme" })
    await client.accounts.get({ id: created.id })
    const page = await client.accounts.list({ pageSize: 25 })
    const search = await client.accounts.list({
      filter: {
        and: [
          { field: "name", operator: "contains", value: "acme" },
          { field: "name", operator: "startsWith", value: "A" },
        ],
      },
      sort: [{ direction: "desc", field: "name", nulls: "last" }],
    })
    const batch = await client.accounts.batchGet({ ids: [created.id] })
    const archived = await client.accounts.archive({
      id: created.id,
      note: "No longer active",
    })
    const archiveBatch = await client.accounts.archiveAll({
      filter: "updatedAt < 2025-01-01",
    })

    expect(calls.map((call) => call.url)).toEqual([
      "https://company.example/api/v1/accounts",
      "https://company.example/api/v1/accounts/account%2F1",
      "https://company.example/api/v1/accounts?pageSize=25",
      "https://company.example/api/v1/accounts/search",
      "https://company.example/api/v1/accounts:batchGet",
      "https://company.example/api/v1/accounts/account%2F1:archive",
      "https://company.example/api/v1/accounts:archiveAll",
    ])
    expect(calls[3]?.init.body).toBe(
      '{"filter":{"and":[{"field":"name","operator":"contains","value":"acme"},{"field":"name","operator":"startsWith","value":"A"}]},"sort":[{"direction":"desc","field":"name","nulls":"last"}]}'
    )
    expect(calls[5]?.init.body).toBe('{"note":"No longer active"}')
    expect(calls[6]?.init.body).toBe('{"filter":"updatedAt < 2025-01-01"}')
    expect(page.nextPageToken).toBe("")
    expect(search.items[0]?.id).toBe(created.id)
    expect(batch.items[0]?.id).toBe(created.id)
    expect(archived.archived).toBe(true)
    expect(archiveBatch.archivedCount).toBe(3)

    type ClientKeys = keyof typeof client
    type AccountMethods = keyof (typeof client)["accounts"]
    expectTypeOf<ClientKeys>().toEqualTypeOf<"accounts">()
    expectTypeOf<AccountMethods>().toEqualTypeOf<
      | "archive"
      | "archiveAll"
      | "batchGet"
      | "create"
      | "get"
      | "list"
      | "update"
    >()
    expectTypeOf(client).toEqualTypeOf<ApiClient<typeof Example>>()
    expectTypeOf(created.id).toEqualTypeOf<RecordId<"account">>()
  })

  it("preserves non-success response details", async () => {
    const client = createClient(Example, {
      fetch: async () =>
        new Response('{"code":"validation"}', {
          status: 422,
          headers: { "content-type": "application/json" },
        }),
    })

    const response = client.accounts.list()
    await expect(response).rejects.toMatchObject({
      body: '{"code":"validation"}',
      status: 422,
    })
    await expect(response).rejects.toBeInstanceOf(ApiClientResponseError)
  })
})
