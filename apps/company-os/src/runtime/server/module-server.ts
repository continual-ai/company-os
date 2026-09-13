import { type Effect, Layer } from "effect"

import type { ModuleDefinition } from "#/runtime/model/index.ts"
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

/** Registers named Effect functions. Providers acquire their dependencies separately. */
export function defineModuleServer<
  M extends ModuleDefinition,
  A extends ModuleHandlers<NoInfer<M>>,
>(
  module: M,
  implementations: A
): {
  readonly module: M
  readonly implementations: A
  readonly layer: Layer.Layer<never>
}
export function defineModuleServer<
  M extends ModuleDefinition,
  A extends ModuleHandlers<NoInfer<M>>,
  LR,
  LE,
  LI,
>(
  module: M,
  implementations: A,
  layer: Layer.Layer<LR, LE, LI>
): {
  readonly module: M
  readonly implementations: A
  readonly layer: Layer.Layer<LR, LE, LI>
}
export function defineModuleServer<
  M extends ModuleDefinition,
  A extends ModuleHandlers<NoInfer<M>>,
  LR,
  LE,
  LI,
>(module: M, implementations: A, layer?: Layer.Layer<LR, LE, LI>) {
  return { module, implementations, layer: layer ?? Layer.empty }
}
