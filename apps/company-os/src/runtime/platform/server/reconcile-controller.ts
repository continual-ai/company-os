import { Effect } from "effect"

import {
  type ActionInput,
  isRecordAlias,
  RecordId,
} from "#/runtime/model/index.ts"
import { ControllerInstance } from "#/runtime/platform/model/controller-instance.ts"
import { Controller } from "#/runtime/platform/model/controller.ts"
import {
  type ReconcileController,
  type ReconcileControllerInstance,
  ControllerReconciliationRequested,
} from "#/runtime/platform/model/reconcile-controller.ts"
import { activeModuleModel } from "#/runtime/platform/server/activation.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { Database } from "#/runtime/server/database.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"

const invalid = (message: string) =>
  Effect.fail({
    status: "FAILED_PRECONDITION" as const,
    reason: "FAILED_PRECONDITION",
    message,
    details: { violations: [] },
  })

export const reconcileController = Effect.fn("platform.reconcileController")(
  function* (input: ActionInput<typeof ReconcileController>) {
    yield* requireProjectAccess
    const database = yield* Database
    const controller = yield* database
      .repository(Controller)
      .get({ id: input.id })
    const { model } = yield* activeModuleModel()
    const module = Object.values(model.modules).find((candidate) =>
      candidate.controllers.some(
        (definition) => definition.id === controller.definitionId
      )
    )
    const definition = module?.controllers.find(
      (candidate) => candidate.id === controller.definitionId
    )
    if (!module || !definition)
      return yield* invalid("This controller is not enabled.")
    if (
      input.key !== undefined &&
      (definition.scope === "object" || !input.key)
    )
      return yield* invalid(
        "Provide a nonempty record ID only for a record controller."
      )
    let key = input.key
    if (key) {
      const object = model.objects[definition.objectType]!
      key = (yield* database
        .repository(object)
        .get({ id: isRecordAlias(key) ? key : RecordId(object.id)(key) })).id
    }
    // The action transaction commits an attributed request before any worker can execute it.
    yield* (yield* EventJournal).append(ControllerReconciliationRequested, {
      subject: controller.id,
      related: key ? [key] : [],
      data: { key: key ?? null },
    })
    return { accepted: true }
  }
)

export const reconcileControllerInstance = Effect.fn(
  "platform.reconcileControllerInstance"
)(function* (input: ActionInput<typeof ReconcileControllerInstance>) {
  yield* requireProjectAccess
  const instance = yield* (yield* Database)
    .repository(ControllerInstance)
    .get({ id: input.id })
  const controller = instance.links.controller
  const record = instance.links.record
  if (typeof controller !== "string")
    return yield* Effect.die(
      new Error("Controller instance is missing its controller link")
    )
  return yield* reconcileController({
    id: RecordId(Controller.id)(controller),
    ...(typeof record === "string" ? { key: record } : {}),
  })
})
