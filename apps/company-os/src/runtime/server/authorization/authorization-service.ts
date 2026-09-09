import { Context, Data, Effect, Layer } from "effect"

import type { PrincipalId } from "#/runtime/access/model/ids.ts"
import {
  type CapabilityCheck,
  type CapabilityPermission,
} from "#/runtime/contract/capabilities.ts"
import { modelTypeAccepts } from "#/runtime/model/index.ts"
import {
  ALL_AUTHENTICATED_CALLERS_PRINCIPAL_SET_ID,
  ALL_CALLERS_PRINCIPAL_SET_ID,
  ROOT_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
} from "#/runtime/model/system-records.ts"
import { AuthorizationRepository } from "#/runtime/server/authorization/authorization-repository.ts"
import type { OperationAccessRequest } from "#/runtime/server/authorization/permission-catalog.ts"
import { callerForActor, type Caller } from "#/runtime/server/caller.ts"
import { currentAuthorizationActorId } from "#/runtime/server/invocation-context.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"

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

interface PermissionRequest {
  readonly expectedType?: string
  readonly modifiesTarget: boolean
  readonly objectType: string
  readonly permission: CapabilityPermission
  readonly readPermission?: CapabilityPermission | undefined
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
  const context = yield* ModelContext
  const { model: Model } = context
  const { objectPermission, permissionDefinition } = context.permissions
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
    const requestedPermissions = new Set<string>(permissions)
    for (const grant of grants) {
      for (const permission of grant.permissions) {
        if (!requestedPermissions.has(permission)) continue
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
    if (decision === "allowed") return undefined
    const recordIds = request.targetIds ?? []
    if (decision === "notFound") {
      return yield* Effect.fail(
        new AuthorizationTargetNotFound({
          objectType: request.expectedType ?? request.objectType,
          recordIds,
        })
      )
    }
    return yield* Effect.fail(
      new PermissionDenied({ permission: request.permission, recordIds })
    )
  })

  const requirePermission = Effect.fn(
    "@company/Authorization.requirePermission"
  )(function* (request: PermissionRequest) {
    const actorId = yield* currentAuthorizationActorId
    return yield* requirePermissionFor(callerForActor(actorId), request)
  })

  /**
   * Fails unless the caller may run one operation. Record operations check the
   * named records; collection operations check the creation parent (root by
   * default); `list` is an object-level gate whose readable rows are filtered
   * separately through `visibleWithin`.
   */
  const require = Effect.fn("@company/Authorization.require")(function* (
    request: OperationAccessRequest
  ) {
    const definition = permissionDefinition(objectPermission(request))
    const targetIds =
      request.operationId === "list"
        ? undefined
        : (request.recordIds ?? [request.parentId ?? ROOT_ID])
    return yield* requirePermission({ ...definition, targetIds })
  })

  const visibleWithin = Effect.fn("@company/Authorization.visibleWithin")(
    function* (
      request: Pick<OperationAccessRequest, "objectType" | "operationId">
    ) {
      const actorId = yield* currentAuthorizationActorId
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

  /** One grant query for a heterogeneous feed; decisions still use current membership and roles. */
  const readableScopes = Effect.fn("@company/Authorization.readableScopes")(
    function* () {
      const caller = callerForActor(yield* currentAuthorizationActorId)
      const permissions = Object.values(Model.objects).map(
        (object) => `${object.id}.get`
      )
      const grants = yield* repository.listGrants({
        directPrincipalIds: directPrincipalIds(caller),
        groupMemberId:
          caller.kind === "identity" ? caller.identityId : undefined,
        permissions,
      })
      return Object.fromEntries(
        permissions.map((permission) => [
          permission.slice(0, -4),
          [
            ...new Set(
              grants
                .filter((grant) => grant.permissions.includes(permission))
                .map((grant) => grant.scopeId)
            ),
          ].sort(),
        ])
      )
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
    const actorId = yield* currentAuthorizationActorId
    return yield* checkCapabilitiesFor(callerForActor(actorId), checks)
  })

  return {
    readableScopes,
    checkCapabilities,
    checkCapabilitiesFor,
    require,
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
