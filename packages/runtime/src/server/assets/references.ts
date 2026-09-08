import { Schema } from "effect"

import { toEffectSchema } from "#/contract/schema.ts"
import type { AnySchema, ObjectType } from "#/model/index.ts"

export interface AssetReference {
  readonly field: string
  readonly assetId: string
  readonly schema: Extract<AnySchema, { kind: "file" | "image" | "media" }>
}

type Collector = (
  value: unknown,
  field: string,
  output: AssetReference[]
) => void

function compile(schema: AnySchema): Collector | undefined {
  switch (schema.kind) {
    case "file":
    case "image":
    case "media":
      return (value, field, output) => {
        if (
          value !== null &&
          typeof value === "object" &&
          "assetId" in value &&
          typeof value.assetId === "string"
        )
          output.push({ field, assetId: value.assetId, schema })
      }
    case "optional":
      return compile(schema.value)
    case "array": {
      const item = compile(schema.items)
      return item === undefined
        ? undefined
        : (value, field, output) => {
            if (Array.isArray(value))
              value.forEach((element, index) =>
                item(element, `${field}.${index}`, output)
              )
          }
    }
    case "map": {
      const item = compile(schema.values)
      return item === undefined
        ? undefined
        : (value, field, output) => {
            if (typeof value === "object" && value !== null)
              for (const [key, member] of Object.entries(value))
                item(member, `${field}.${key}`, output)
          }
    }
    case "struct": {
      const fields = Object.entries(schema.properties).flatMap(
        ([key, property]) => {
          const collect = compile(property)
          return collect === undefined ? [] : [{ key, collect }]
        }
      )
      return fields.length === 0
        ? undefined
        : (value, field, output) => {
            if (typeof value === "object" && value !== null)
              for (const { key, collect } of fields)
                collect(
                  Reflect.get(value, key),
                  field === "" ? key : `${field}.${key}`,
                  output
                )
          }
    }
    case "union": {
      const members = schema.members.map((member) => ({
        matches: Schema.is(toEffectSchema(member)),
        collect: compile(member),
      }))
      return members.every((member) => member.collect === undefined)
        ? undefined
        : (value, field, output) =>
            members
              .find((member) => member.matches(value))
              ?.collect?.(value, field, output)
    }
    default:
      return undefined
  }
}

/** Compiles field behavior once; objects without asset fields have no asset persistence work. */
export function compileAssetReferences(object: ObjectType) {
  const collect = compile({ kind: "struct", properties: object.properties })
  return collect === undefined
    ? undefined
    : (values: Readonly<Record<string, unknown>>) => {
        const references: AssetReference[] = []
        collect(values, "", references)
        return references
      }
}
