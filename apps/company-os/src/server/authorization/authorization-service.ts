import { Model, type PrincipalId } from "@company/model"
import { modelTypeAccepts } from "@company/runtime"
import { type ObjectAccessRequest } from "@company/runtime/effect/object-service"
import { Context, Data, Effect, Layer } from "effect"

import type { CapabilityCheck } from "@/capabilities"
import { callerForActor, type Caller } from "@/server/caller"
import { currentActorId } from "@/server/invocation-context"
import {
  ALL_AUTHENTICATED_CALLERS_PRINCIPAL_SET_ID,
  ALL_CALLERS_PRINCIPAL_SET_ID,
  PLATFORM_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
} from "@/system-records"

import { AuthorizationRepository } from "./authorization-repository"
import { objectPermission, permissionDefinition } from "./permission-catalog"

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

interface ActionAccessRequest {
  readonly actionId: string
  readonly objectType: string
  readonly parentId?: string
  readonly recordIds?: ReadonlyArray<string>
}

interface PermissionRequest {
  readonly expectedType?: string
  readonly modifiesTarget: boolean
  readonly objectType: string
  readonly permission: string
  readonly readPermission?: string | undefined
  readonly targetIds?: ReadonlyArray<string> | undefined
}

type AuthorizationDecision = "allowed" | "forbidden" | "notFound"

function directPrincipalIds(caller: Caller): ReadonlyArray<PrincipalId> {
  switch (caller.kind) {
    case "anonymous":
      return [ALL_CALLERS_PRINCIPAL_SET_ID]
    case "authenticated":
      return [
        ALL_CALLERS_PRINCIPAL_SET_ID,
        ALL_AUTHENTICATED_CALLERS_PRINCIPAL_SET_ID,
      ]
    case "identity":
      return [
        caller.identityId,
        ALL_CALLERS_PRINCIPAL_SET_ID,
        ALL_AUTHENTICATED_CALLERS_PRINCIPAL_SET_ID,
      ]
    default:
      return caller satisfies never
  }
}

function isSystemCaller(caller: Caller): boolean {
  return (
    caller.kind === "identity" &&
    caller.identityId === SYSTEM_SERVICE_ACCOUNT_ID
  )
}

const make = Effect.gen(function* () {
  const repository = yield* AuthorizationRepository

  // Decisions intentionally read current assignments and group membership so
  // changes earlier in the same transaction take effect without cache repair.
  const decide = Effect.fn("@company/Authorization.decide")(function* (
    caller: Caller,
    requests: ReadonlyArray<PermissionRequest>
  ) {
    if (requests.length === 0) return []
    const targetIds = [
      ...new Set(requests.flatMap((request) => request.targetIds ?? [])),
    ]
    const targets = yield* repository.getTargets(targetIds)
    const targetsById = new Map(targets.map((target) => [target.id, target]))
    const scopeIds = [
      ...new Set(
        targets.flatMap((target) => [target.id, ...target.ancestorIds])
      ),
    ]
    const permissions = [
      ...new Set(
        requests.flatMap((request) => [
          request.permission,
          ...(request.readPermission === undefined
            ? []
            : [request.readPermission]),
        ])
      ),
    ]
    const unrestricted = requests.some(
      (request) => request.targetIds === undefined
    )
    const grants = yield* repository.listGrants({
      directPrincipalIds: directPrincipalIds(caller),
      groupMemberId: caller.kind === "identity" ? caller.identityId : undefined,
      permissions,
      scopeIds: unrestricted ? undefined : scopeIds,
    })
    const scopesByPermission = new Map<string, Set<string>>()
    for (const grant of grants) {
      for (const permission of grant.permissions) {
        if (!permissions.includes(permission)) continue
        const permittedScopes = scopesByPermission.get(permission) ?? new Set()
        permittedScopes.add(grant.scopeId)
        scopesByPermission.set(permission, permittedScopes)
      }
    }

    return requests.map((request): AuthorizationDecision => {
      const permittedScopes =
        scopesByPermission.get(request.permission) ?? new Set()
      if (request.targetIds === undefined) {
        return permittedScopes.size > 0 ? "allowed" : "forbidden"
      }

      const requestTargets = request.targetIds.map((id) => targetsById.get(id))
      if (
        requestTargets.some(
          (target) =>
            target === undefined ||
            (request.expectedType !== undefined &&
              !modelTypeAccepts(Model, target.objectType, request.expectedType))
        )
      ) {
        return "notFound"
      }
      const concreteTargets = requestTargets.filter(
        (target) => target !== undefined
      )
      const denied = concreteTargets.some(
        (target) =>
          (request.modifiesTarget &&
            target.systemManaged &&
            !isSystemCaller(caller)) ||
          !permittedAtTarget(target, permittedScopes)
      )
      if (!denied) return "allowed"

      if (request.readPermission !== undefined) {
        const readableScopeIds =
          scopesByPermission.get(request.readPermission) ?? new Set()
        if (
          concreteTargets.some(
            (target) => !permittedAtTarget(target, readableScopeIds)
          )
        ) {
          return "notFound"
        }
      }
      return "forbidden"
    })
  })

  const requirePermissionFor = Effect.fn(
    "@company/Authorization.requirePermissionFor"
  )(function* (caller: Caller, request: PermissionRequest) {
    const [decision] = yield* decide(caller, [request])
    if (decision === "allowed") return
    const recordIds = request.targetIds ?? []
    if (decision === "notFound") {
      yield* Effect.fail(
        new AuthorizationTargetNotFound({
          objectType: request.expectedType ?? request.objectType,
          recordIds,
        })
      )
    }
    yield* Effect.fail(
      new PermissionDenied({ permission: request.permission, recordIds })
    )
  })

  const requirePermission = Effect.fn(
    "@company/Authorization.requirePermission"
  )(function* (request: PermissionRequest) {
    const actorId = yield* currentActorId
    return yield* requirePermissionFor(callerForActor(actorId), request)
  })

  const require = Effect.fn("@company/Authorization.require")(function* (
    request: ObjectAccessRequest
  ) {
    const definition = permissionDefinition(objectPermission(request))
    const targetIds =
      request.recordIds ??
      (request.parentId === undefined ? [PLATFORM_ID] : [request.parentId])
    return yield* requirePermission({
      ...definition,
      targetIds,
    })
  })

  const requireAction = Effect.fn("@company/Authorization.requireAction")(
    function* (request: ActionAccessRequest) {
      const definition = permissionDefinition(
        `${request.objectType}.${request.actionId}`
      )
      return yield* requirePermission({
        ...definition,
        targetIds:
          request.recordIds ??
          (request.parentId === undefined ? [PLATFORM_ID] : [request.parentId]),
      })
    }
  )

  const requireActionFor = Effect.fn("@company/Authorization.requireActionFor")(
    function* (caller: Caller, request: ActionAccessRequest) {
      const definition = permissionDefinition(
        `${request.objectType}.${request.actionId}`
      )
      return yield* requirePermissionFor(caller, {
        ...definition,
        targetIds:
          request.recordIds ??
          (request.parentId === undefined ? [PLATFORM_ID] : [request.parentId]),
      })
    }
  )

  const visibleWithin = Effect.fn("@company/Authorization.visibleWithin")(
    function* (request: ObjectAccessRequest) {
      const actorId = yield* currentActorId
      const permission = objectPermission(request)
      const caller = callerForActor(actorId)
      const grants = yield* repository.listGrants({
        directPrincipalIds: directPrincipalIds(caller),
        groupMemberId:
          caller.kind === "identity" ? caller.identityId : undefined,
        permissions: [permission],
      })
      return [...new Set(grants.map(({ scopeId }) => scopeId))]
    }
  )

  const checkCapabilitiesFor = Effect.fn(
    "@company/Authorization.checkCapabilitiesFor"
  )(function* (caller: Caller, checks: ReadonlyArray<CapabilityCheck>) {
    const requests = checks.map((check): PermissionRequest => {
      const definition = permissionDefinition(check.permission)
      return {
        ...definition,
        targetIds: check.target === undefined ? undefined : [check.target],
      }
    })
    return yield* decide(caller, requests).pipe(
      Effect.map((decisions) => ({
        results: decisions.map((decision) => ({
          allowed: decision === "allowed",
        })),
      }))
    )
  })

  const checkCapabilities = Effect.fn(
    "@company/Authorization.checkCapabilities"
  )(function* (checks: ReadonlyArray<CapabilityCheck>) {
    const actorId = yield* currentActorId
    return yield* checkCapabilitiesFor(callerForActor(actorId), checks)
  })

  return {
    checkCapabilities,
    checkCapabilitiesFor,
    require,
    requireAction,
    requireActionFor,
    visibleWithin,
  }
})

/** The model's hierarchy-based, default-deny authorization policy. */
export class Authorization extends Context.Service<Authorization>()(
  "@company/Authorization",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
