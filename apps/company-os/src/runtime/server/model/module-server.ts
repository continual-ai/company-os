import { Effect, Layer } from "effect"

import type { ModuleDefinition } from "#/runtime/model/index.ts"
import type { CustomOperationService } from "#/runtime/server/model-implementation.ts"
import type { ObjectService } from "#/runtime/server/model/object-service.ts"

/** Overrides may fail and require anything; binding supplies their services and erases the types once. */
type Loose<S> = {
  readonly [K in keyof S]: S[K] extends (
    input: infer I
  ) => Effect.Effect<infer A, unknown, unknown>
    ? (input: I) => Effect.Effect<A, unknown, unknown>
    : S[K]
}
type Operations<M extends ModuleDefinition> =
  | M["actions"][number]
  | M["queries"][number]
type ModuleOverrides<M extends ModuleDefinition> = {
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
> & {
    readonly [O in M["objects"][number] as O["id"]]?: Partial<
      Loose<ObjectService<O>>
    >
  }
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
export type OperationRequirements<A> = {
  [K in keyof A]: Requirements<A[K]>
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
