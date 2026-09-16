import { createServer } from "node:http"

import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"
import { Context, Effect, Layer } from "effect"
import {
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http"

import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { createModelMcpHandler } from "#/runtime/server/mcp.ts"
import { OperationExecutor } from "#/runtime/server/operation-executor.ts"

/** Isolated test database, loopback transport, and the real governed operation executor. */
export const serveTestMcp = Effect.gen(function* () {
  const operations = yield* OperationExecutor
  const calls: string[] = []
  const handler = yield* Effect.acquireRelease(
    Effect.sync(() =>
      createModelMcpHandler(async () => ({
        model: (await Effect.runPromise(operations.activeModel)).model,
        name: "Company OS test",
        version: "0.0.0",
        run: (contract, input) => {
          calls.push(contract.key)
          return Effect.runPromise(
            operations.run(systemInvocation, contract, input).pipe(
              Effect.match({
                onFailure: (error) => ({ success: false as const, error }),
                onSuccess: ({ value }) => ({ success: true as const, value }),
              })
            )
          )
        },
      }))
    ),
    (server) => Effect.promise(() => server.close())
  )
  const context = yield* Layer.build(
    NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })
  )
  const server = Context.get(context, HttpServer.HttpServer)
  yield* server.serve(
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const web = yield* HttpServerRequest.toWeb(request)
      const response = yield* Effect.promise(() => handler.fetch(web))
      return HttpServerResponse.fromWeb(response)
    })
  )
  if (server.address._tag !== "TcpAddress")
    return yield* Effect.die("Expected a TCP test server")
  return { url: `http://127.0.0.1:${server.address.port}/mcp`, calls }
})
