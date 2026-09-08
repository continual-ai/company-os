import { Effect, Layer } from "effect"

import type { ModuleDefinition, ObjectType } from "#/model/index.ts"
import type {
  CustomOperationService,
  ObjectImplementation,
} from "#/server/model-implementation.ts"

type Overrides<O extends ObjectType> = CustomOperationService<O, unknown> &
  Partial<
    Omit<ObjectImplementation<O, unknown>, keyof CustomOperationService<O>>
  >
type ModuleOverrides<M extends ModuleDefinition> = {
  readonly [
    O in M["objects"][number] as keyof CustomOperationService<O> extends never
      ? never
      : O["id"]
  ]: Overrides<O>
} & {
  readonly [O in M["objects"][number] as O["id"]]?: Overrides<O>
}
export type OperationRequirements<A> = {
  [O in keyof A]: {
    [K in keyof A[O]]: A[O][K] extends (
      ...args: never[]
    ) => Effect.Effect<unknown, unknown, infer R>
      ? R
      : never
  }[keyof A[O]]
}[keyof A]

type ModuleServer<M, A, E, R, L> = {
  readonly module: M
  readonly implementations: Effect.Effect<A, E, R>
  readonly layer: L
}

/** Declares typed overrides without binding services or capturing invocation state. */
export function defineModuleServer<
  M extends ModuleDefinition,
  A extends ModuleOverrides<NoInfer<M>>,
  E = never,
  R = never,
>(
  module: M,
  implementations: A | Effect.Effect<A, E, R>
): ModuleServer<M, A, E, R, Layer.Layer<never>>
export function defineModuleServer<
  M extends ModuleDefinition,
  A extends ModuleOverrides<NoInfer<M>>,
  E = never,
  R = never,
  LR = never,
  LE = never,
  LI = never,
>(
  module: M,
  implementations: A | Effect.Effect<A, E, R>,
  layer: Layer.Layer<LR, LE, LI>
): ModuleServer<M, A, E, R, Layer.Layer<LR, LE, LI>>

export function defineModuleServer<
  M extends ModuleDefinition,
  A extends ModuleOverrides<NoInfer<M>>,
  E = never,
  R = never,
  LR = never,
  LE = never,
  LI = never,
>(
  module: M,
  implementations: A | Effect.Effect<A, E, R>,
  layer?: Layer.Layer<LR, LE, LI>
) {
  return {
    module,
    layer: layer ?? Layer.empty,
    implementations: Effect.isEffect(implementations)
      ? implementations
      : Effect.succeed(implementations),
  }
}
