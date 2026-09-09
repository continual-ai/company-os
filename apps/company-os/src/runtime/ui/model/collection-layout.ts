import { Schema } from "effect"

import type { ObjectType } from "#/runtime/model/index.ts"

export const CollectionLayoutSchema = Schema.Union([
  Schema.Struct({ type: Schema.Literal("table") }),
  Schema.Struct({ type: Schema.Literal("feed") }),
  Schema.Struct({ type: Schema.Literal("kanban"), groupBy: Schema.String }),
  Schema.Struct({
    type: Schema.Literal("calendar"),
    start: Schema.String,
    end: Schema.optionalKey(Schema.String),
  }),
  Schema.Struct({
    type: Schema.Literal("gantt"),
    start: Schema.String,
    end: Schema.String,
  }),
])
export type CollectionLayout = typeof CollectionLayoutSchema.Type
export type ScheduleLayout = Extract<
  CollectionLayout,
  { type: "calendar" | "gantt" }
>

export function collectionLayoutFields(object: ObjectType) {
  const fields = Object.entries(object.properties)
  return {
    groups: fields.filter(([, field]) => field.kind === "enum"),
    dates: fields.filter(
      ([, field]) =>
        field.kind === "string" &&
        (field.format === "date" || field.format === "timestamp")
    ),
  }
}

/** Invalid source mappings fail at composition; temporary URL mappings get an actionable UI error. */
export function collectionLayoutError(
  object: ObjectType,
  layout: CollectionLayout
): string | undefined {
  const { groups, dates } = collectionLayoutFields(object)
  if (layout.type === "table" || layout.type === "feed") return undefined
  if (layout.type === "kanban")
    return groups.some(([id]) => id === layout.groupBy)
      ? undefined
      : "Choose a select field to group this board."
  if (!dates.some(([id]) => id === layout.start))
    return "Choose a date field for the start."
  if (
    layout.end !== undefined &&
    (!dates.some(([id]) => id === layout.end) || layout.end === layout.start)
  )
    return "Choose a different date field for the end."
  return undefined
}

export function defaultCollectionLayout(
  object: ObjectType,
  type: CollectionLayout["type"]
): CollectionLayout | undefined {
  const { groups, dates } = collectionLayoutFields(object)
  if (type === "table" || type === "feed") return { type }
  if (type === "kanban") {
    const group =
      groups.find(([id]) => id === object.display.status) ?? groups[0]
    return group && { type, groupBy: group[0] }
  }
  if (dates[0] === undefined) return undefined
  if (type === "calendar") return { type, start: dates[0][0] }
  return dates[1] && { type, start: dates[0][0], end: dates[1][0] }
}
