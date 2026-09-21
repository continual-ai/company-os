import { Cron, Duration } from "effect"

import type { NoExtraKeys } from "#/runtime/model/definition/identity.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"

export type ControllerDuration = Exclude<
  Extract<Duration.Input, string>,
  "Infinity" | "-Infinity"
>

export function controllerDurationMillis(value: ControllerDuration): number {
  const millis = Duration.toMillis(Duration.fromInputUnsafe(value))
  if (!Number.isFinite(millis) || millis <= 0)
    throw new Error("Controller durations must be positive and finite.")
  return millis
}

export type ControllerDefinition = {
  readonly id: string
  readonly name?: string
  readonly description?: string
  /** Ignore target updates that write only these properties. Mixed updates still trigger. */
  readonly ignoreUpdates?: ReadonlyArray<string>
  /** Named link paths whose records and edges affect this target. */
  readonly watch?: ReadonlyArray<string>
  readonly schedule?: { readonly cron: string; readonly timeZone?: string }
  readonly minInterval?: ControllerDuration
} & (
  | { readonly record: ObjectType; readonly object?: never }
  | { readonly object: ObjectType; readonly record?: never }
)

export interface Controller<
  S extends "record" | "object" = "record" | "object",
  T extends string = string,
> {
  readonly kind: "controller"
  readonly id: string
  readonly name: string
  readonly description: string
  readonly objectType: T
  readonly scope: S
  readonly ignoreUpdates?: ReadonlyArray<string>
  readonly watch: ReadonlyArray<string>
  readonly schedule?: { readonly cron: string; readonly timeZone: string }
  readonly minInterval?: ControllerDuration
}

type DefinedController<D extends ControllerDefinition> = Controller<
  D extends { readonly record: ObjectType } ? "record" : "object",
  (D extends { readonly record: infer O extends ObjectType }
    ? O
    : D extends { readonly object: infer O extends ObjectType }
      ? O
      : never)["id"]
>

/** The target determines the reconciliation key, not which records may be changed. */
export function defineController<const D extends ControllerDefinition>(
  definition: D & NoExtraKeys<D, ControllerDefinition>
): DefinedController<D> {
  if (!/^[a-z][a-zA-Z0-9-]*$/.test(definition.id))
    throw new Error(
      "Controller ids must start with a lowercase letter and contain letters, digits, or hyphens."
    )
  const target = definition.record ?? definition.object
  if (!target || (definition.record && definition.object))
    throw new Error(
      "A controller must specify exactly one of record or object."
    )
  if (definition.ignoreUpdates?.some((field) => !(field in target.properties)))
    throw new Error(
      "Ignored update fields must belong to the controller target."
    )
  if (
    definition.watch?.some(
      (path) => !/^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/.test(path)
    )
  )
    throw new Error(
      "Controller watches must be link paths, such as affiliations.account.notes."
    )
  if (definition.minInterval !== undefined)
    controllerDurationMillis(definition.minInterval)
  const schedule = definition.schedule && {
    cron: definition.schedule.cron,
    timeZone: definition.schedule.timeZone ?? "UTC",
  }
  if (schedule) Cron.parseUnsafe(schedule.cron, schedule.timeZone)
  const controller: Controller = {
    kind: "controller" as const,
    id: definition.id,
    name: definition.name ?? definition.id,
    description: definition.description ?? "",
    ...(definition.ignoreUpdates
      ? { ignoreUpdates: definition.ignoreUpdates }
      : {}),
    objectType: target.id,
    ...(schedule ? { schedule } : {}),
    ...(definition.minInterval !== undefined
      ? { minInterval: definition.minInterval }
      : {}),
    scope: definition.record ? ("record" as const) : ("object" as const),
    watch: [...new Set(definition.watch ?? [])],
  }
  // SAFETY: the runtime target and scope are derived from the same exclusive input union.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return controller as DefinedController<D>
}
