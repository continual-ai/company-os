import * as NodeClusterHttp from "@effect/platform-node/NodeClusterHttp"
import { Config, Effect, Layer, Option } from "effect"
import { RunnerAddress } from "effect/unstable/cluster"

import { Model } from "#/app.model.ts"
import { serverModules } from "#/app.server.ts"
import { agentLayer } from "#/app/server/agent.ts"
import * as Postgres from "#/app/server/database/postgres.ts"
import type { Controller } from "#/runtime/model/index.ts"
import { controllerLayer } from "#/runtime/server/controllers/runtime.ts"

const serverControllers = serverModules.flatMap<
  (typeof serverModules)[number]["controllers"][number]
>((server) => server.controllers)
const definitions = Object.values(Model.modules).flatMap<Controller>(
  (module) => module.controllers
)
for (const definition of definitions)
  if (
    serverControllers.filter((server) => server.definition === definition)
      .length !== 1
  )
    throw new Error(
      `Controller '${definition.id}' requires exactly one server implementation.`
    )

const cluster = Layer.unwrap(
  Effect.gen(function* () {
    const host = yield* Config.string("CONTROLLERS_HOST").pipe(
      Config.withDefault("localhost")
    )
    const port = yield* Config.int("CONTROLLERS_PORT").pipe(
      Config.withDefault(34431)
    )
    const listenHost = yield* Config.string("CONTROLLERS_LISTEN_HOST").pipe(
      Config.withDefault(host)
    )
    return NodeClusterHttp.layer({
      transport: "http",
      storage: "sql",
      shardingConfig: {
        runnerAddress: Option.some(RunnerAddress.make(host, port)),
        runnerListenAddress: Option.some(RunnerAddress.make(listenHost, port)),
        entityMessagePollInterval: "1 second",
        entityTerminationTimeout: "2 seconds",
      },
    })
  })
).pipe(Layer.provide(Postgres.sqlLayer))

/** An internal RPC listener in the web process; replicas coordinate through Effect Cluster. */
export const controllersLayer = Layer.mergeAll(
  Layer.empty,
  ...serverControllers.map((server) =>
    controllerLayer<
      Effect.Services<
        ReturnType<(typeof serverControllers)[number]["reconcile"]>
      >
    >(Model, server)
  )
).pipe(
  Layer.provide(cluster),
  Layer.provide(Postgres.eventNotificationsLayer),
  Layer.provide(agentLayer)
)
