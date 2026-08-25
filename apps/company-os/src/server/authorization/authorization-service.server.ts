import { Model } from "@company/model"
import { modelTypeAccepts } from "@company/runtime"
import { type ObjectAccessRequest } from "@company/runtime/effect/object-service"
import { Context, Data, Effect, Layer } from "effect"

import { currentActorId } from "@/server/invocation-context.server"

import { AuthorizationRepository } from "./authorization-repository.server"
import { objectPermission } from "./permission-catalog.server"
import {
  PLATFORM_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
} from "./well-known-authorization.server"

export class AuthorizationTargetNotFound extends Data.TaggedError(
  "AuthorizationTargetNotFound"
)<{
  readonly objectType: string
  readonly recordIds: ReadonlyArray<string>
}> {}

export class PermissionDenied extends Data.TaggedError("PermissionDenied")<{
  readonly permission: string
  readonly recordIds: ReadonlyArray<string>
}> {}

function permittedAtTarget(
  target: { readonly ancestorIds: ReadonlyArray<string>; readonly id: string },
  permittedScopeIds: ReadonlySet<string>
): boolean {
  return (
    permittedScopeIds.has(target.id) ||
    target.ancestorIds.some((ancestorId) => permittedScopeIds.has(ancestorId))
  )
}

function isSystemManagedMutation(operation: ObjectAccessRequest["operation"]) {
  return (
    operation === "batchDelete" ||
    operation === "delete" ||
    operation === "update"
  )
}

interface ActionAccessRequest {
  readonly actionId: string
  readonly modifiesTarget?: boolean
  readonly objectType: string
  readonly parentId?: string
  readonly parentTypeId?: string
  readonly recordIds?: ReadonlyArray<string>
}

interface PermissionRequest {
  readonly modifiesTarget: boolean
  readonly objectType: string
  readonly parentId?: string
  readonly parentTypeId?: string
  readonly permission: string
  readonly recordIds?: ReadonlyArray<string>
}

const make = Effect.gen(function* () {
  const repository = yield* AuthorizationRepository

  // Decisions intentionally read current assignments and group membership so
  // changes earlier in the same transaction take effect without cache repair.
  const requirePermission = Effect.fn(
    "@company/Authorization.requirePermission"
  )(function* (request: PermissionRequest) {
    const actorId = yield* currentActorId
    const targetIds =
      request.recordIds ??
      (request.parentId === undefined ? [PLATFORM_ID] : [request.parentId])
    const targets = yield* repository.getTargets(targetIds)
    const targetsById = new Map(targets.map((target) => [target.id, target]))
    const expectedType = request.parentTypeId ?? request.objectType
    const missing = targetIds.find((id) => {
      const target = targetsById.get(id)
      return (
        target === undefined ||
        !modelTypeAccepts(Model, target.objectType, expectedType)
      )
    })
    if (missing !== undefined) {
      return yield* Effect.fail(
        new AuthorizationTargetNotFound({
          objectType: expectedType,
          recordIds: [missing],
        })
      )
    }
    const scopeIds = [
      ...new Set(
        targets.flatMap((target) => [target.id, ...target.ancestorIds])
      ),
    ]
    const permittedScopeIds = new Set(
      yield* repository.listScopeIdsWithPermission({
        actorId,
        permission: request.permission,
        scopeIds,
      })
    )
    const denied = targets.find(
      (target) =>
        (request.modifiesTarget &&
          target.systemManaged &&
          actorId !== SYSTEM_SERVICE_ACCOUNT_ID) ||
        !permittedAtTarget(target, permittedScopeIds)
    )
    if (denied === undefined) return undefined

    if (request.recordIds !== undefined) {
      const readPermission = `${request.objectType}.get`
      const readableScopeIds =
        readPermission === request.permission
          ? permittedScopeIds
          : new Set(
              yield* repository.listScopeIdsWithPermission({
                actorId,
                permission: readPermission,
                scopeIds,
              })
            )
      const unreadable = targets.find(
        (target) => !permittedAtTarget(target, readableScopeIds)
      )
      if (unreadable !== undefined) {
        return yield* Effect.fail(
          new AuthorizationTargetNotFound({
            objectType: request.objectType,
            recordIds: [unreadable.id],
          })
        )
      }
    }

    return yield* Effect.fail(
      new PermissionDenied({
        permission: request.permission,
        recordIds: [denied.id],
      })
    )
  })

  const require = Effect.fn("@company/Authorization.require")(function* (
    request: ObjectAccessRequest
  ) {
    return yield* requirePermission({
      ...request,
      modifiesTarget: isSystemManagedMutation(request.operation),
      permission: objectPermission(request),
    })
  })

  const requireAction = Effect.fn("@company/Authorization.requireAction")(
    function* (request: ActionAccessRequest) {
      return yield* requirePermission({
        ...request,
        modifiesTarget: request.modifiesTarget === true,
        permission: `${request.objectType}.${request.actionId}`,
      })
    }
  )

  const visibleWithin = Effect.fn("@company/Authorization.visibleWithin")(
    function* (request: ObjectAccessRequest) {
      const actorId = yield* currentActorId
      const permission = objectPermission(request)
      return yield* repository.listScopeIdsWithPermission({
        actorId,
        permission,
      })
    }
  )

  const can = Effect.fn("@company/Authorization.can")(function* (
    request: ObjectAccessRequest
  ) {
    return yield* require(request).pipe(
      Effect.as(true),
      Effect.catchTags({
        AuthorizationTargetNotFound: () => Effect.succeed(false),
        PermissionDenied: () => Effect.succeed(false),
      })
    )
  })

  return { can, require, requireAction, visibleWithin }
})

/** The model's hierarchy-based, default-deny authorization policy. */
export class Authorization extends Context.Service<Authorization>()(
  "@company/Authorization",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
