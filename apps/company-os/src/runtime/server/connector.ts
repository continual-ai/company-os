import { Data, Effect, type Redacted } from "effect"

import {
  RecordId,
  type ConnectorDefinition,
  type ObjectGetInput,
  type ObjectRecord,
} from "#/runtime/model/index.ts"
import { Connection } from "#/runtime/platform/model/connection.ts"
import { Connector } from "#/runtime/platform/model/connector.ts"
import { ModuleSetting } from "#/runtime/platform/model/module-setting.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { Credentials } from "#/runtime/server/credentials.ts"
import { Database } from "#/runtime/server/database.ts"

export class ConnectionError extends Data.TaggedError("ConnectionError")<{
  readonly reason:
    | "disabled"
    | "authorization"
    | "rateLimit"
    | "unavailable"
    | "connectorMismatch"
  readonly message: string
  readonly retryAfter?: number
}> {}

/** Bind a code-defined provider to the common Platform connection model. */
export function defineConnectorServer<Client, E, R>(
  definition: ConnectorDefinition,
  implementation: {
    readonly createClient: (
      token: Redacted.Redacted,
      connection: ObjectRecord<typeof Connection>
    ) => Effect.Effect<Client, E, R>
  }
) {
  return {
    definition,
    client: Effect.fn(`${definition.id}.client`)(function* (
      id: ObjectGetInput<typeof Connection>["id"]
    ) {
      yield* requireProjectAccess
      const database = yield* Database
      const connection = yield* database.repository(Connection).get({ id })
      const connectorId = connection.links.connector
      if (typeof connectorId !== "string")
        return yield* Effect.fail(
          new ConnectionError({
            reason: "connectorMismatch",
            message: "Connection has no connector.",
          })
        )
      const connector = yield* database
        .repository(Connector)
        .get({ id: RecordId("connector")(connectorId) })
      if (connector.definitionId !== definition.id)
        return yield* Effect.fail(
          new ConnectionError({
            reason: "connectorMismatch",
            message: "Connection belongs to another connector.",
          })
        )
      const moduleId = connector.links.module
      const module =
        typeof moduleId === "string"
          ? yield* database
              .repository(ModuleSetting)
              .get({ id: RecordId("moduleSetting")(moduleId) })
          : undefined
      if (!connector.available || !module?.enabled)
        return yield* Effect.fail(
          new ConnectionError({
            reason: "disabled",
            message: "Connector is unavailable or its module is disabled.",
          })
        )
      const credentials = yield* Credentials
      const token = yield* credentials.get(Connection, connection.id, "token")
      if (!token)
        return yield* Effect.fail(
          new ConnectionError({
            reason: "authorization",
            message: "Add a personal access token to start syncing.",
          })
        )
      return yield* implementation.createClient(token, connection)
    }),
  }
}
