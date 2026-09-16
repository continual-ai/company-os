import { Effect } from "effect"

import {
  type QueryInput,
  type QueryOutput,
  isRecordAlias,
  RecordId,
} from "#/runtime/model/index.ts"
import { ControllerInstance } from "#/runtime/platform/model/controller-instance.ts"
import type { ControllerStatus } from "#/runtime/platform/model/controller-status.ts"
import { Controller } from "#/runtime/platform/model/controller.ts"
import { activeModuleModel } from "#/runtime/platform/server/activation.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { Database } from "#/runtime/server/database.ts"
import { RecordIdentifiers } from "#/runtime/server/storage/identifiers.ts"

export const controllerStatus = Effect.fn("controller.status")(function* (
  input: QueryInput<typeof ControllerStatus>
) {
  yield* requireProjectAccess
  const database = yield* Database
  const controller = yield* database
    .repository(Controller)
    .get({ id: input.id })
  const { model } = yield* activeModuleModel()
  const enabled = Object.values(model.modules).some((module) =>
    module.controllers.some(
      (definition) => definition.id === controller.definitionId
    )
  )
  const key =
    input.key === undefined
      ? undefined
      : yield* (yield* RecordIdentifiers).resolve(
          controller.targetObjectType,
          isRecordAlias(input.key)
            ? input.key
            : RecordId(controller.targetObjectType)(input.key)
        )
  const { sql } = database
  const controllerInstances = database.table(ControllerInstance)
  const where = sql.and([
    sql`controller_id = ${controller.id}`,
    ...(key !== undefined ? [sql`record_id = ${key}`] : []),
  ])
  const [summary] = yield* sql<{
    instances: number
    runs: number
    failures: number
    pending: number
    running: number
    errors: number
    lastStartedAt: string | null
    lastSucceededAt: string | null
    requeueAt: string | null
  }>`select count(*)::int as instances, coalesce(sum(runs), 0)::float8 as runs,
      coalesce(sum(failures), 0)::float8 as failures,
      count(*) filter (where state = 'pending')::int as pending,
      count(*) filter (where state = 'running')::int as running,
      count(*) filter (where state = 'error')::int as errors,
      max(last_started_at) as "lastStartedAt", max(last_succeeded_at) as "lastSucceededAt", min(requeue_at) as "requeueAt"
      from ${controllerInstances} where ${where}`
  const [error] = yield* sql<{
    lastError: string
    lastErrorKey: string
  }>`select last_error as "lastError", coalesce(record_id, 'object') as "lastErrorKey" from ${controllerInstances}
      where ${where} and last_error is not null order by last_started_at desc nulls last limit 1`
  const session =
    key === undefined && controller.scope === "record"
      ? undefined
      : (yield* sql<{
          url: string | null
        }>`select agent_session_url as url from ${controllerInstances} where ${where} limit 1`)[0]
  const state: QueryOutput<typeof ControllerStatus>["state"] = summary!.errors
    ? "error"
    : summary!.running
      ? "running"
      : summary!.pending
        ? "pending"
        : summary!.instances
          ? "idle"
          : "notStarted"
  return {
    ...summary!,
    agentSessionUrl: session?.url ?? null,
    enabled,
    paused: controller.paused,
    state,
    lastError: error?.lastError ?? null,
    lastErrorKey: error?.lastErrorKey ?? null,
  } satisfies QueryOutput<typeof ControllerStatus>
})
