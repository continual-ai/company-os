import {
  Cause,
  Cron,
  DateTime,
  Duration,
  Effect,
  Layer,
  Queue,
  Schedule,
  Schema,
} from "effect"
import {
  ClusterCron,
  ClusterSchema,
  DeliverAt,
  Entity,
  Sharding,
} from "effect/unstable/cluster"
import { Rpc } from "effect/unstable/rpc"

import { toEffectSchema } from "#/runtime/contract/schema.ts"
import { controllerDurationMillis } from "#/runtime/model/definition/controller.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"
import type { PageToken } from "#/runtime/model/index.ts"
import {
  Controller as ControllerObject,
  controllerAlias,
} from "#/runtime/platform/model/controller.ts"
import { ControllerReconciliationRequested } from "#/runtime/platform/model/reconcile-controller.ts"
import { activeModuleModel } from "#/runtime/platform/server/activation.ts"
import { AgentSession, AgentError } from "#/runtime/server/agent.ts"
import type { ControllerServer } from "#/runtime/server/controllers/definition.ts"
import { ControllerStorage } from "#/runtime/server/controllers/storage.ts"
import { Database } from "#/runtime/server/database.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { EventNotifications } from "#/runtime/server/events/event-notifications.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"

const retry = Schedule.exponential("100 millis").pipe(
  Schedule.modifyDelay(({ duration }) =>
    Effect.succeed(Duration.min(duration, Duration.seconds(30)))
  )
)
const objectKey = "object"

/** Immediate and delayed wakeups use the same durable mailbox. */
class Wakeup extends Schema.Class<Wakeup>("ControllerWakeup")({
  dateTime: Schema.DateTimeUtc,
  scheduled: Schema.Boolean,
}) {
  [DeliverAt.symbol]() {
    return this.dateTime
  }
}

/** Persisted envelopes remain unacknowledged until their reconciliation succeeds. */
export function controllerLayer<R>(
  model: ModelCatalog,
  server: ControllerServer<R>
) {
  const definition = server.definition
  const module = Object.values(model.modules).find((candidate) =>
    candidate.controllers.includes(definition)
  )
  if (!module)
    throw new Error(
      `Controller '${definition.id}' is not registered in this model.`
    )
  const entity = Entity.make(`controller/${definition.id}`, [
    Rpc.make("Wake", { payload: Wakeup }).annotate(
      ClusterSchema.Persisted,
      true
    ),
  ])
  const minInterval = definition.minInterval
    ? controllerDurationMillis(definition.minInterval)
    : 0
  const enabled = activeModuleModel().pipe(
    Effect.map(({ model: active }) => module.id in active.modules)
  )
  const handlers = entity.toLayerQueue(
    Effect.gen(function* () {
      const address = yield* Entity.CurrentAddress
      const storage = yield* ControllerStorage
      const database = yield* Database
      const client = (yield* entity.client)(address.entityId)
      return (mailbox, reply) =>
        Effect.gen(function* () {
          while (true) {
            const batch = yield* Queue.takeAll(mailbox)
            yield* Effect.gen(function* () {
              const timing = yield* storage.timing(
                definition.id,
                address.entityId,
                minInterval
              )
              if (!timing) return
              // A later successful pass replaces or cancels its predecessor's delayed follow-up.
              if (
                !batch.some(
                  ({ payload }) =>
                    !payload.scheduled ||
                    payload.dateTime.epochMilliseconds ===
                      Date.parse(timing.requeueAt ?? "")
                )
              )
                return
              while (true) {
                // Sleep without a SQL transaction; persisted lastStartedAt preserves the throttle on restart.
                const current = yield* storage.timing(
                  definition.id,
                  address.entityId,
                  minInterval
                )
                if (!current) return
                if (!(yield* enabled)) {
                  yield* Effect.sleep("1 second")
                  continue
                }
                if (current.waitMillis > 0) {
                  yield* Effect.sleep(current.waitMillis)
                  continue
                }
                // Admission and pause updates serialize on the controller row. The lock is
                // released before user code runs, so pausing never waits for a reconciliation.
                const started = yield* database.transaction(() =>
                  Effect.gen(function* () {
                    const [controller] = yield* database.sql<{
                      paused: boolean
                    }>`select paused from ${database.table(ControllerObject)} where definition_id = ${definition.id} for share`
                    if (!controller) return "gone"
                    if (controller.paused) return "paused"
                    return (yield* storage.started(
                      definition.id,
                      address.entityId
                    ))
                      ? "started"
                      : "gone"
                  })
                )
                if (started === "gone") return
                if (started === "started") break
                yield* Effect.sleep("1 second")
              }
              batch.push(...(yield* Queue.takeBetween(mailbox, 0, Infinity)))
              const result = yield* server.reconcile(address.entityId).pipe(
                Effect.provideService(AgentSession, {
                  current: storage.get(definition.id, address.entityId).pipe(
                    Effect.map((instance) =>
                      instance?.agentSessionId
                        ? {
                            id: instance.agentSessionId,
                            url: instance.agentSessionUrl,
                          }
                        : undefined
                    ),
                    Effect.mapError(
                      (cause) =>
                        new AgentError({
                          message: "Could not load agent session",
                          cause,
                        })
                    )
                  ),
                  save: (session) =>
                    storage
                      .saveSession(definition.id, address.entityId, session)
                      .pipe(
                        Effect.asVoid,
                        Effect.mapError(
                          (cause) =>
                            new AgentError({
                              message: "Could not save agent session",
                              cause,
                            })
                        )
                      ),
                })
              )
              const dateTime =
                result?.requeueAfter === undefined
                  ? undefined
                  : DateTime.addDuration(
                      yield* DateTime.now,
                      controllerDurationMillis(result.requeueAfter)
                    )
              // Persist the follow-up before acknowledging the attempt. A crash can repeat a pass, never lose it.
              if (dateTime)
                yield* client.Wake(new Wakeup({ dateTime, scheduled: true }), {
                  discard: true,
                })
              yield* storage.succeeded(
                definition.id,
                address.entityId,
                dateTime ? DateTime.formatIso(dateTime) : null
              )
            }).pipe(
              Effect.catchCause((cause) =>
                Effect.gen(function* () {
                  yield* storage.failed(
                    definition.id,
                    address.entityId,
                    Cause.pretty(cause)
                  )
                  yield* Effect.logError(
                    `Controller '${definition.id}' failed`,
                    cause
                  )
                  return yield* Effect.fail(cause)
                })
              ),
              Effect.retry(retry)
            )
            // Only acknowledge the batch taken before the read; later wakeups need another pass.
            yield* Effect.forEach(batch, (request) =>
              reply.succeed(request, undefined)
            )
          }
        }).pipe(Effect.orDie)
    })
  )
  const consume = Effect.gen(function* () {
    const client = yield* entity.client
    const journal = yield* EventJournal
    const database = yield* Database
    const controllerRecord = yield* database
      .repository(ControllerObject)
      .get({ id: controllerAlias(definition.id) })
    const storage = yield* ControllerStorage
    const notifications = yield* EventNotifications
    const sharding = yield* Sharding.Sharding
    const add = (key: string) =>
      Effect.gen(function* () {
        if (!(yield* storage.pending(definition.id, key))) return
        yield* client(key).Wake(
          new Wakeup({ dateTime: yield* DateTime.now, scheduled: false }),
          { discard: true }
        )
      })
    const scan = Effect.gen(function* () {
      if (definition.scope === "object") {
        yield* add(objectKey)
        return
      }
      const object = model.objects[definition.objectType]!
      let pageToken: PageToken | undefined
      do {
        const page = yield* database
          .repository(object)
          .list({ pageSize: 100, ...(pageToken ? { pageToken } : {}) })
        for (const record of page.items) yield* add(record.id)
        pageToken = page.nextPageToken ?? undefined
      } while (pageToken)
    })
    if (definition.schedule) {
      yield* Layer.build(
        ClusterCron.make({
          name: `controller-rescan/${definition.id}`,
          cron: Cron.parseUnsafe(
            definition.schedule.cron,
            definition.schedule.timeZone
          ),
          // Each tick only enqueues keys. Execution still observes activation and per-key throttling.
          execute: Effect.gen(function* () {
            if (yield* enabled) yield* scan
          }).pipe(Effect.retry(retry)),
        })
      )
    }
    // Cluster elects one journal reader per controller, independently of the per-key workers.
    yield* sharding.registerSingleton(
      `controller-events/${definition.id}`,
      Effect.gen(function* () {
        const wakeup = yield* notifications.subscribe
        while (true) {
          yield* Effect.gen(function* () {
            if (!(yield* enabled)) {
              yield* Effect.sleep("1 second")
              return
            }
            let cursor = yield* storage.cursor(definition.id)
            if (cursor === undefined) {
              // Capture the boundary before scanning so changes during the scan are replayed.
              cursor = (yield* journal.list({ cursor: "now" })).nextCursor
              yield* scan
              // A saved cursor also records completed initialization. Interrupted scans may repeat.
              yield* storage.saveCursor(definition.id, cursor)
            }
            const page = yield* journal
              .list({ cursor, pageSize: 100 })
              .pipe(
                Effect.catchTag("InvalidEventCursor", () =>
                  journal.list({ pageSize: 100 })
                )
              )
            for (const event of page.items) {
              if (event.type === ControllerReconciliationRequested.type) {
                const request = yield* Schema.decodeUnknownEffect(
                  toEffectSchema(ControllerReconciliationRequested.data)
                )(event.data)
                if (
                  event.subjects.some(
                    (subject) => subject.id === controllerRecord.id
                  )
                ) {
                  if (request.key === null) yield* scan
                  else yield* add(request.key)
                }
                continue
              }
              if (Object.hasOwn(event.controllerKeys, definition.id))
                for (const key of event.controllerKeys[definition.id]!)
                  yield* add(key)
            }
            // A crash before this write replays events; reconciliation must tolerate duplicates.
            yield* storage.saveCursor(definition.id, page.nextCursor)
            if (!page.hasMore)
              yield* Effect.raceFirst(wakeup, Effect.sleep("1 second"))
          }).pipe(
            Effect.catchCause((cause) =>
              Effect.logError(
                `Controller '${definition.id}' event reader failed`,
                cause
              ).pipe(Effect.andThen(Effect.fail(cause)))
            ),
            Effect.retry(retry)
          )
        }
      })
    )
  }).pipe(Layer.effectDiscard)
  return Layer.merge(handlers, consume).pipe(
    Layer.provide(ControllerStorage.layer),
    Layer.provide(Layer.succeed(CurrentInvocation, systemInvocation))
  )
}
