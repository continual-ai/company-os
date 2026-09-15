import { Effect } from "effect"

import {
  type QueryInput,
  type QueryOutput,
  isRecordAlias,
  RecordId,
} from "#/runtime/model/index.ts"
import type { ControllerStatus } from "#/runtime/platform/model/controller-status.ts"
import { Controller } from "#/runtime/platform/model/controller.ts"
import { activeModuleModel } from "#/runtime/platform/server/activation.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { Database } from "#/runtime/server/database.ts"
import { RecordIdentifiers } from "#/runtime/server/storage/identifiers.ts"
import { controllerInstances } from "#/runtime/server/storage/infrastructure.ts"

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
  const where = sql.and([
    sql`controller_id = ${controller.definitionId}`,
    ...(key !== undefined ? [sql`key = ${key}`] : []),
  ])
  const [summary] = yield* sql<{
    instances: number
    attempts: number
    pending: number
    running: number
    errors: number
    lastStartedAt: string | null
    lastSucceededAt: string | null
    requeueAt: string | null
  }>`select count(*)::int as instances, coalesce(sum(attempts), 0)::float8 as attempts,
      count(*) filter (where state = 'pending')::int as pending,
      count(*) filter (where state = 'running')::int as running,
      count(*) filter (where state = 'error')::int as errors,
      max(last_started_at) as "lastStartedAt", max(last_succeeded_at) as "lastSucceededAt", min(requeue_at) as "requeueAt"
      from ${controllerInstances} where ${where}`
  const [error] = yield* sql<{
    lastError: string
    lastErrorKey: string
  }>`select last_error as "lastError", key as "lastErrorKey" from ${controllerInstances}
      where ${where} and last_error is not null order by last_started_at desc nulls last limit 1`
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
    enabled,
    paused: controller.paused,
    state,
    lastError: error?.lastError ?? null,
    lastErrorKey: error?.lastErrorKey ?? null,
  } satisfies QueryOutput<typeof ControllerStatus>
})
