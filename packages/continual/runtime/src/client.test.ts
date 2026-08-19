import { describe, expect, expectTypeOf, it } from "vitest"

import { ApiClientResponseError, createClient, type ApiClient } from "./client"
import { defineAction } from "./definition/action"
import { defineApi } from "./definition/api"
import { field } from "./definition/field"
import { defineModule } from "./definition/module"
import { defineObject } from "./definition/object"
import { schema, type RecordId } from "./definition/schema"

const Account = defineObject({
  id: "account",
  collection: "accounts",
  name: "Account",
  pluralName: "Accounts",
  fields: {
    name: field.text({ required: true }),
  },
  display: { title: "name" },
  operations: { delete: false },
})

const ArchiveAccount = defineAction({
  id: "archiveAccount",
  verb: "archive",
  name: "Archive account",
  subject: Account,
  input: schema.object({}),
  output: schema.object({ accountId: schema.recordId(Account) }),
  errors: [],
})

const Example = defineApi({
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

const accountRecord = {
  annotations: {},
  createdAt: "2026-08-18T18:00:00Z",
  createdById: "user-1",
  etag: "etag-1",
  id: "account/1",
  name: "Acme",
  updatedAt: "2026-08-18T18:00:00Z",
  updatedById: "user-1",
}

function responseBody(url: string) {
  if (url.endsWith(":archive")) {
    return { accountId: accountRecord.id }
  }
  if (url.endsWith(":batchGet")) {
    return { items: [accountRecord] }
  }
  if (url.includes("?")) {
    return { items: [accountRecord], nextPageToken: "" }
  }
  return accountRecord
}

describe("inferred API client", () => {
  it("groups inferred methods by object collection without module namespaces", async () => {
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
    ])

    const created = await client.accounts.create({ name: "Acme" })
    await client.accounts.get(created.id)
    const page = await client.accounts.list({ pageSize: 25 })
    const batch = await client.accounts.batchGet({ ids: [created.id] })
    const archived = await client.accounts.archive(created.id)

    expect(calls.map((call) => call.url)).toEqual([
      "https://company.example/api/v1/accounts",
      "https://company.example/api/v1/accounts/account%2F1",
      "https://company.example/api/v1/accounts?pageSize=25",
      "https://company.example/api/v1/accounts:batchGet",
      "https://company.example/api/v1/accounts/account%2F1:archive",
    ])
    expect(calls[0]?.init.method).toBe("POST")
    expect(calls[3]?.init.body).toBe('{"ids":["account/1"]}')
    expect(page.nextPageToken).toBe("")
    expect(batch.items[0]?.id).toBe(created.id)
    expect(archived.accountId).toBe(created.id)

    type ClientKeys = keyof typeof client
    type AccountMethods = keyof (typeof client)["accounts"]
    expectTypeOf<ClientKeys>().toEqualTypeOf<"accounts">()
    expectTypeOf<AccountMethods>().toEqualTypeOf<
      "archive" | "batchGet" | "create" | "get" | "list" | "update"
    >()
    expectTypeOf(client).toEqualTypeOf<ApiClient<typeof Example>>()
    expectTypeOf(archived.accountId).toEqualTypeOf<RecordId<"account">>()
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
