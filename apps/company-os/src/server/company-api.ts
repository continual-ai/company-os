/* oxlint-disable anti-slop/no-reflect-get, anti-slop/no-runtime-typeof, anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type */
// Effect decodes every request against the generated endpoint schema before this
// one dynamic compiler dispatches it to services built from the same closed Model.
import { Model } from "@company/model"
import {
  isRecordAlias,
  isStandardActionId,
  modelObjects,
  RecordId,
  type ObjectType,
  type RecordIdentifier,
} from "@company/runtime"
import {
  HttpValidationMiddleware,
  httpEndpointId,
} from "@company/runtime/effect/http"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Context, Data, Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { HttpApiBuilder, type HttpApiEndpoint } from "effect/unstable/httpapi"

import { applicationHttpApi } from "@/http-api"

import {
  internalApiError,
  unauthenticatedApiError,
  withApiErrors,
} from "./api-error"
import { Authentication } from "./auth/authentication"
import { UserAuthentication } from "./auth/user-authentication"
import { Authorization } from "./authorization/authorization-service"
import { ApiKeyService } from "./objects/api-key-service"
import { InvitationService } from "./objects/invitation-service"
import { LeadService } from "./objects/lead-service"
import { RoleAssignmentService } from "./objects/role-assignment-service"
import { ServiceAccountService } from "./objects/service-account-service"
import { StandardObjectServices } from "./objects/standard-object-services"
import { UserService } from "./objects/user-service"

class CompanyApiFailure extends Data.TaggedError("CompanyApiFailure")<{
  readonly cause: unknown
}> {}

interface HandlerRequest {
  readonly params?: Readonly<Record<string, unknown>>
  readonly payload?: Readonly<Record<string, unknown>>
  readonly query?: Readonly<Record<string, unknown>>
  readonly request: {
    readonly headers: Readonly<Record<string, string>>
  }
}

type OperationEffect = Effect.Effect<unknown, unknown, CurrentInvocation>

interface ExecutableObjectService {
  readonly batchDelete?: (input: unknown) => OperationEffect
  readonly batchGet: (input: unknown) => OperationEffect
  readonly create?: (input: unknown) => OperationEffect
  readonly delete?: (input: unknown) => OperationEffect
  readonly get: (input: unknown) => OperationEffect
  readonly list: (input?: unknown) => OperationEffect
  readonly update?: (input: unknown) => OperationEffect
}

interface InvitationActions {
  readonly issue: (input: unknown) => OperationEffect
  readonly revoke: (id: unknown) => OperationEffect
}

interface ApiKeyActions {
  readonly issue: (input: unknown) => OperationEffect
  readonly revoke: (id: unknown) => OperationEffect
}

interface ServiceAccountActions {
  readonly disable: (id: unknown) => OperationEffect
  readonly enable: (id: unknown) => OperationEffect
}

interface UserActions {
  readonly reactivate: (id: unknown) => OperationEffect
  readonly suspend: (id: unknown) => OperationEffect
}

interface LeadActions {
  readonly convert: (id: unknown) => OperationEffect
}

type DynamicHandler = (
  request: HandlerRequest
) => Effect.Effect<unknown, unknown>

interface DynamicHandlers {
  readonly handle: (
    identifier: string,
    handler: DynamicHandler
  ) => DynamicHandlers
}

type CompleteHandlers = HttpApiBuilder.Handlers<
  never,
  Record<string, HttpApiEndpoint.Constraint>,
  string
>

// The caller names the closed service contract at this one dynamic compiler boundary.
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
function applicationService<TService>(service: unknown): TService {
  // SAFETY: every service is selected from the exhaustive closed-model catalog;
  // generated schemas validate inputs before the compiler invokes it.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return service as TService
}

function requestHeaders(request: HandlerRequest): Headers {
  return new Headers(request.request.headers)
}

function requestString(
  values: Readonly<Record<string, unknown>> | undefined,
  name: string
): string {
  const value = Reflect.get(values ?? {}, name)
  return typeof value === "string" ? value : ""
}

function invitationIdentifier(
  values: Readonly<Record<string, unknown>> | undefined,
  name: string
): RecordIdentifier<"invitation"> {
  const value = requestString(values, name)
  return isRecordAlias(value) ? value : RecordId("invitation")(value)
}

function authenticated<A, E>(
  authentication: Authentication["Service"],
  request: HandlerRequest,
  operation: Effect.Effect<A, E, CurrentInvocation>
) {
  return authentication.authenticate(requestHeaders(request)).pipe(
    Effect.flatMap((invocation) =>
      operation.pipe(Effect.provideService(CurrentInvocation, invocation))
    ),
    withApiErrors
  )
}

function standardHandlers(
  handlers: DynamicHandlers,
  object: ObjectType,
  service: ExecutableObjectService,
  authentication: Authentication["Service"]
): DynamicHandlers {
  let result = handlers
  result = result.handle(httpEndpointId("list", object), (request) =>
    authenticated(authentication, request, service.list(request.query))
  )
  result = result.handle(httpEndpointId("search", object), (request) =>
    authenticated(authentication, request, service.list(request.payload))
  )
  result = result.handle(httpEndpointId("batchGet", object), (request) =>
    authenticated(authentication, request, service.batchGet(request.payload))
  )
  if (object.actions.batchDelete !== undefined) {
    if (service.batchDelete === undefined) {
      throw new Error(`${object.id}.batchDelete has no service implementation.`)
    }
    result = result.handle(httpEndpointId("batchDelete", object), (request) =>
      authenticated(
        authentication,
        request,
        service.batchDelete!(request.payload)
      )
    )
  }
  if (object.actions.create !== undefined) {
    if (service.create === undefined) {
      throw new Error(`${object.id}.create has no service implementation.`)
    }
    result = result.handle(httpEndpointId("create", object), (request) =>
      authenticated(authentication, request, service.create!(request.payload))
    )
  }
  result = result.handle(httpEndpointId("get", object), (request) =>
    authenticated(authentication, request, service.get(request.params))
  )
  if (object.actions.update !== undefined) {
    if (service.update === undefined) {
      throw new Error(`${object.id}.update has no service implementation.`)
    }
    result = result.handle(httpEndpointId("update", object), (request) =>
      authenticated(
        authentication,
        request,
        service.update!({ ...request.params, ...request.payload })
      )
    )
  }
  if (object.actions.delete !== undefined) {
    if (service.delete === undefined) {
      throw new Error(`${object.id}.delete has no service implementation.`)
    }
    result = result.handle(httpEndpointId("delete", object), (request) =>
      authenticated(
        authentication,
        request,
        service.delete!({ ...request.params, ...request.query })
      )
    )
  }
  return result
}

const make = Effect.gen(function* () {
  const authentication = yield* Authentication
  const authorization = yield* Authorization
  const userAuthentication = yield* UserAuthentication
  const apiKeys = yield* ApiKeyService
  const invitations = yield* InvitationService
  const apiKeyActions = applicationService<ApiKeyActions>(apiKeys)
  const invitationActions = applicationService<InvitationActions>(invitations)
  const serviceAccounts = yield* ServiceAccountService
  const users = yield* UserService
  const serviceAccountActions =
    applicationService<ServiceAccountActions>(serviceAccounts)
  const userActions = applicationService<UserActions>(users)
  const leads = yield* LeadService
  const leadActions = applicationService<LeadActions>(leads)
  const standard = yield* StandardObjectServices
  const services = {
    anonymousActor: standard.anonymousActor,
    apiKey: apiKeys,
    company: standard.company,
    contact: standard.contact,
    deal: standard.deal,
    group: standard.group,
    groupMembership: standard.groupMembership,
    interaction: standard.interaction,
    invitation: invitations,
    lead: leads,
    lineItem: standard.lineItem,
    principalSet: standard.principalSet,
    role: standard.role,
    roleAssignment: yield* RoleAssignmentService,
    serviceAccount: serviceAccounts,
    user: users,
  } satisfies Record<keyof typeof Model.objects, unknown>

  const customActionHandlers = {
    "apiKey.issue": (request) =>
      authenticated(
        authentication,
        request,
        apiKeyActions.issue(request.payload)
      ),
    "apiKey.revoke": (request) =>
      authenticated(
        authentication,
        request,
        apiKeyActions
          .revoke(requestString(request.params, "id"))
          .pipe(Effect.as({}))
      ),
    "invitation.accept": (request) =>
      userAuthentication
        .acceptInvitation(
          requestHeaders(request),
          invitationIdentifier(request.params, "id"),
          requestString(request.payload, "redemptionToken")
        )
        .pipe(
          Effect.map(({ user }) => ({ user })),
          withApiErrors
        ),
    "invitation.issue": (request) =>
      authenticated(
        authentication,
        request,
        invitationActions.issue(request.payload)
      ),
    "invitation.revoke": (request) =>
      authenticated(
        authentication,
        request,
        invitationActions
          .revoke(requestString(request.params, "id"))
          .pipe(Effect.as({}))
      ),
    "serviceAccount.disable": (request) =>
      authenticated(
        authentication,
        request,
        serviceAccountActions
          .disable(requestString(request.params, "id"))
          .pipe(Effect.as({}))
      ),
    "lead.convert": (request) =>
      authenticated(
        authentication,
        request,
        leadActions.convert(requestString(request.params, "id"))
      ),
    "serviceAccount.enable": (request) =>
      authenticated(
        authentication,
        request,
        serviceAccountActions
          .enable(requestString(request.params, "id"))
          .pipe(Effect.as({}))
      ),
    "user.reactivate": (request) =>
      authenticated(
        authentication,
        request,
        userActions
          .reactivate(requestString(request.params, "id"))
          .pipe(Effect.as({}))
      ),
    "user.suspend": (request) =>
      authenticated(
        authentication,
        request,
        userActions
          .suspend(requestString(request.params, "id"))
          .pipe(Effect.as({}))
      ),
  } satisfies Readonly<Record<string, DynamicHandler>>

  const groupLayers = modelObjects(Model).map((object) =>
    HttpApiBuilder.group(applicationHttpApi, object.id, (initialHandlers) => {
      const service = applicationService<ExecutableObjectService>(
        Reflect.get(services, object.id)
      )
      let handlers = standardHandlers(
        // SAFETY: this compiler registers every endpoint derived from the same
        // object definition before returning a complete handler collection.
        // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
        initialHandlers as unknown as DynamicHandlers,
        object,
        service,
        authentication
      )

      for (const action of Object.values(object.actions)) {
        if (isStandardActionId(action.id)) continue
        const identifier = httpEndpointId(action.id, object, action.scope)
        const actionKey = `${object.id}.${action.id}`
        // SAFETY: the membership check narrows a model-derived action key to the
        // literal keys in this declarative custom action registry.
        const handler = Object.hasOwn(customActionHandlers, actionKey)
          ? customActionHandlers[
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion
              actionKey as keyof typeof customActionHandlers
            ]
          : undefined
        if (handler === undefined) {
          throw new Error(
            `No Company API handler is registered for ${actionKey}.`
          )
        }
        handlers = handlers.handle(identifier, handler)
      }
      // SAFETY: standardHandlers covers every generated standard endpoint and
      // the loop above covers every custom action in the closed model.
      // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
      return handlers as unknown as CompleteHandlers
    })
  )

  const firstGroupLayer = groupLayers[0]
  if (firstGroupLayer === undefined) {
    return yield* Effect.die("The application model contains no API objects.")
  }
  const objectGroupsLayer = groupLayers
    .slice(1)
    .reduce((layers, group) => Layer.merge(layers, group), firstGroupLayer)
  const capabilityGroupLayer = HttpApiBuilder.group(
    applicationHttpApi,
    "capabilities",
    (handlers) =>
      handlers.handle("checkCapabilities", (request) =>
        authentication.identify(requestHeaders(request)).pipe(
          Effect.mapError(() =>
            unauthenticatedApiError("Authentication credentials are invalid.")
          ),
          Effect.flatMap((caller) =>
            authorization
              .checkCapabilitiesFor(caller, request.payload.checks)
              .pipe(
                Effect.catch((error) =>
                  Effect.logError("Capability evaluation failed", error).pipe(
                    Effect.andThen(Effect.fail(internalApiError()))
                  )
                )
              )
          )
        )
      )
  )
  const groupsLayer = Layer.merge(objectGroupsLayer, capabilityGroupLayer)
  const apiLayer = HttpApiBuilder.layer(applicationHttpApi).pipe(
    Layer.provide(groupsLayer),
    Layer.provide(HttpValidationMiddleware.layer),
    Layer.provide(HttpServer.layerServices)
  )
  const webHandler = yield* Effect.acquireRelease(
    Effect.sync(() =>
      HttpRouter.toWebHandler(apiLayer, { disableLogger: true })
    ),
    ({ dispose }) => Effect.promise(dispose)
  )

  return {
    handle: Effect.fn("@company/CompanyApi.handle")(function* (
      request: Request
    ) {
      return yield* Effect.tryPromise({
        try: () => webHandler.handler(request),
        catch: (cause) => new CompanyApiFailure({ cause }),
      }).pipe(
        Effect.catch(({ cause }) =>
          Effect.logError("Company API handler failed", cause).pipe(
            Effect.as(
              Response.json(internalApiError(), {
                status: 500,
              })
            )
          )
        )
      )
    }),
  }
})

/** Fetch-compatible generated API bound to the governed application services. */
export class CompanyApi extends Context.Service<CompanyApi>()(
  "@company/CompanyApi",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
