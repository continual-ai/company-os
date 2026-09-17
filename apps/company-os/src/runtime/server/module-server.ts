import { type Effect, Layer } from "effect"

import type {
  ConnectorDefinition,
  ModuleDefinition,
} from "#/runtime/model/index.ts"
import type { Agent, AgentSession } from "#/runtime/server/agent.ts"
import type { ControllerServer } from "#/runtime/server/controllers/definition.ts"
import type { CurrentInvocation } from "#/runtime/server/invocation.ts"
import type { CustomOperationService } from "#/runtime/server/operation-handlers.ts"

type Operations<M extends ModuleDefinition> =
  | M["actions"][number]
  | M["queries"][number]
type ModuleHandlers<M extends ModuleDefinition> = {
  readonly [
    O in Operations<M> as O["objectType"] extends string
      ? O["objectType"]
      : never
  ]: CustomOperationService<
    Extract<Operations<M>, { readonly objectType: O["objectType"] }>,
    unknown
  >
} & CustomOperationService<
  Extract<Operations<M>, { readonly objectType: undefined }>,
  unknown
>
type Requirements<A> = A extends (
  ...args: never[]
) => Effect.Effect<unknown, unknown, infer R>
  ? R
  : {
      [K in keyof A]: A[K] extends (
        ...args: never[]
      ) => Effect.Effect<unknown, unknown, infer R>
        ? R
        : never
    }[keyof A]
export type OperationRequirements<A> = A extends unknown
  ? {
      [K in keyof A]: Requirements<A[K]>
    }[keyof A]
  : never

/** Shared server composition shape; concrete registrations retain their inferred dependencies. */
export interface ModuleServer {
  readonly module: ModuleDefinition
  readonly operations: object
  readonly connectors: ReadonlyArray<{
    readonly definition: ConnectorDefinition
  }>
  readonly controllers: ReadonlyArray<ControllerServer<unknown>>
  readonly layer: Layer.Layer<never, unknown, unknown>
}

type ControllerRequirements<C> = C extends ControllerServer<infer R> ? R : never

export type ModuleRequirements<C extends ReadonlyArray<ModuleServer>> = Exclude<
  | OperationRequirements<C[number]["operations"]>
  | Exclude<
      ControllerRequirements<C[number]["controllers"][number]>,
      Agent | AgentSession
    >,
  CurrentInvocation
>

/** Bind shared contracts to server handlers and optional Effect service providers. */
export function defineModuleServer<
  M extends ModuleDefinition,
  A extends ModuleHandlers<NoInfer<M>> = ModuleHandlers<M>,
  const C extends ReadonlyArray<ControllerServer<unknown>> = readonly [],
  LR = never,
  LE = never,
  LI = never,
>(
  module: M,
  implementation: {
    readonly connectors?: ReadonlyArray<{
      readonly definition: ConnectorDefinition
    }>
    readonly controllers?: C
    readonly layer?: Layer.Layer<LR, LE, LI>
  } & ([Operations<M>] extends [never]
    ? { readonly operations?: A }
    : { readonly operations: A })
): {
  readonly module: M
  readonly operations: A
  readonly connectors: ReadonlyArray<{
    readonly definition: ConnectorDefinition
  }>
  readonly controllers: C
  readonly layer: Layer.Layer<LR, LE, LI>
}
export function defineModuleServer(
  module: ModuleDefinition,
  implementation: {
    readonly operations?: object
    readonly connectors?: ReadonlyArray<{
      readonly definition: ConnectorDefinition
    }>
    readonly controllers?: ReadonlyArray<ControllerServer<unknown>>
    readonly layer?: Layer.Layer<never, unknown, unknown>
  }
) {
  const connectors = implementation.connectors ?? []
  const connectorDefinitions = new Set(module.connectors)
  for (const connector of connectors)
    if (!connectorDefinitions.delete(connector.definition))
      throw new Error(
        `Connector '${connector.definition.id}' is duplicated or not declared by module '${module.id}'.`
      )
  for (const definition of connectorDefinitions)
    throw new Error(
      `Connector '${definition.id}' has no server binding in module '${module.id}'.`
    )
  const controllers = implementation.controllers ?? []
  const declared = new Set(module.controllers)
  for (const server of controllers) {
    if (!declared.delete(server.definition))
      throw new Error(
        `Controller '${server.definition.id}' is duplicated or not declared by module '${module.id}'.`
      )
  }
  for (const definition of declared)
    throw new Error(
      `Controller '${definition.id}' has no implementation in module '${module.id}'.`
    )
  if (
    !implementation.operations &&
    (module.actions.length || module.queries.length)
  )
    throw new Error(`Module '${module.id}' requires operation implementations.`)
  return {
    module,
    operations: implementation.operations ?? {},
    connectors,
    controllers,
    layer: implementation.layer ?? Layer.empty,
  }
}
