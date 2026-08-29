import {
  InMemoryTransport,
  LATEST_PROTOCOL_VERSION,
  type JSONRPCMessage,
  type JSONRPCRequest,
  type JSONRPCResponse,
} from "@modelcontextprotocol/server"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { defineInterface } from "./definition/interface"
import { defineModel } from "./definition/model"
import { defineModule } from "./definition/module"
import { defineObject } from "./definition/object"
import { PageToken } from "./definition/request"
import { defineRoot } from "./definition/root"
import { schema } from "./definition/schema"
import { NotFoundError } from "./definition/standard-error"
import {
  createModelMcpServer,
  type ModelMcpBinding,
  validateModelMcpRequest,
} from "./effect-mcp"
import { type ModelServiceMap } from "./effect-model-implementation"
import { CurrentInvocation } from "./effect-object-service"

const Actor = defineInterface({
  id: "actor",
  name: "Actor",
  pluralName: "Actors",
})
const Root = defineRoot({
  id: "root",
  implements: [{ interface: Actor }],
  name: "Root",
})
const Contact = defineObject({
  id: "contact",
  collection: "contacts",
  name: "Contact",
  parent: Root,
  pluralName: "Contacts",
  properties: { name: schema.string() },
  display: { title: "name" },
  actions: {
    enroll: {
      description: "Enrolls a contact.",
      input: { notify: schema.optional(schema.boolean()) },
      name: "Enroll contact",
      output: { enrolled: schema.boolean() },
      scope: "object",
    },
  },
})
const TestModel = defineModel({
  actor: Actor,
  modules: [
    defineModule({
      id: "contacts",
      interfaces: [Actor],
      links: [],
      name: "Contacts",
      objects: [Contact],
    }),
  ],
  name: "Test",
  root: Root,
})

function services(): ModelServiceMap<typeof TestModel> {
  return {
    contact: {
      batchDelete: unused,
      batchGet: unused,
      create: unused,
      delete: unused,
      enroll: () => Effect.succeed({ enrolled: true }),
      get: unused,
      list: () =>
        Effect.succeed({ items: [], nextPageToken: null, totalSize: 0 }),
      update: unused,
    },
  }
}

const unused = () => Effect.die("not called")

function rpcClient(transport: InMemoryTransport) {
  type SuccessResponse = Extract<JSONRPCResponse, { readonly result: unknown }>
  const pending = new Map<string | number, (message: SuccessResponse) => void>()
  // The MCP transport exposes an EventTarget-like callback property rather
  // than addEventListener.
  // oxlint-disable-next-line unicorn/prefer-add-event-listener
  transport.onmessage = (message: JSONRPCMessage) => {
    if (!("id" in message) || !("result" in message)) return
    pending.get(message.id)?.(message)
    pending.delete(message.id)
  }
  return (request: JSONRPCRequest) =>
    new Promise<SuccessResponse>((resolve) => {
      pending.set(request.id, resolve)
      void transport.send(request)
    })
}

function toolNames(response: JSONRPCResponse): ReadonlyArray<string> {
  if (!("result" in response))
    throw new Error("Expected a successful response.")
  const tools = Reflect.get(response.result, "tools")
  if (!Array.isArray(tools)) throw new Error("Expected an MCP tool list.")
  return tools.map((tool) => {
    if (typeof tool !== "object" || tool === null) {
      throw new Error("Expected an MCP tool descriptor.")
    }
    const name = Reflect.get(tool, "name")
    if (typeof name !== "string") throw new Error("Expected an MCP tool name.")
    return name
  })
}

describe("model MCP projection", () => {
  it("validates Host and Origin against an explicit allowlist", () => {
    const policy = { allowedHostnames: ["model.example.com"] }

    expect(
      validateModelMcpRequest(
        new Request("https://attacker.example/api/mcp", {
          headers: { host: "attacker.example" },
        }),
        policy
      )?.status
    ).toBe(403)
    expect(
      validateModelMcpRequest(
        new Request("https://model.example.com/api/mcp", {
          headers: {
            host: "model.example.com",
            origin: "https://model.example.com",
          },
        }),
        policy
      )
    ).toBeUndefined()
  })

  it("publishes model queries and actions as tools and dispatches to services", async () => {
    // SAFETY: the preceding test and services() validate this closed binding;
    // widening here keeps the protocol test focused on runtime behavior.
    const links = {
      initialize: () => Effect.void,
      link: () => Effect.void,
      list: () =>
        Effect.succeed({
          items: [],
          nextPageToken: PageToken("unused"),
          totalSize: 0,
        }),
      unlink: () => Effect.void,
      update: () => Effect.void,
    }
    const implementation: ModelMcpBinding["implementation"] = {
      links,
      model: TestModel,
      services: services(),
    }
    const server = createModelMcpServer({
      implementation,
      name: "test",
      version: "1.0.0",
      run: (descriptor, operation) =>
        descriptor.key === "contact.get"
          ? Promise.resolve({
              error: {
                details: {
                  violations: [
                    {
                      description: "The contact does not exist.",
                      path: ["id"],
                      reason: "NOT_FOUND",
                    },
                  ],
                },
                message: "Contact not found.",
                reason: NotFoundError.reason,
                status: NotFoundError.status,
              },
              success: false as const,
            })
          : Effect.runPromise(
              operation.pipe(
                Effect.provideService(CurrentInvocation, {
                  actorId: "root",
                  authorizationActorId: "root",
                }),
                Effect.map((value) => ({ success: true as const, value }))
              )
            ),
    })
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair()
    const request = rpcClient(clientTransport)
    await clientTransport.start()
    await server.connect(serverTransport)

    await request({
      id: 1,
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
        protocolVersion: LATEST_PROTOCOL_VERSION,
      },
    })
    await clientTransport.send({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    })

    const listed = await request({
      id: 2,
      jsonrpc: "2.0",
      method: "tools/list",
    })
    expect(toolNames(listed)).toEqual([
      "contact.get",
      "contact.list",
      "contact.batchGet",
      "contact.create",
      "contact.update",
      "contact.delete",
      "contact.batchDelete",
      "contact.enroll",
    ])

    const page = await request({
      id: 3,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: {},
        name: "contact.list",
      },
    })
    expect(page.result).toMatchObject({
      structuredContent: {
        result: { items: [], nextPageToken: null, totalSize: 0 },
      },
    })

    const called = await request({
      id: 4,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { id: "alice", notify: true },
        name: "contact.enroll",
      },
    })
    expect(called.result).toMatchObject({
      structuredContent: { enrolled: true },
    })

    const failed = await request({
      id: 5,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { id: "missing" },
        name: "contact.get",
      },
    })
    expect(failed.result).toMatchObject({
      content: [
        {
          text: expect.stringContaining('"reason":"NOT_FOUND"'),
          type: "text",
        },
      ],
      isError: true,
    })

    await clientTransport.close()
    await server.close()
  })
})
