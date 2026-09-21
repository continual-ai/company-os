import {
  normalizeProperties,
  type PropertyDefinition,
} from "#/runtime/model/definition/property.ts"
import { schema } from "#/runtime/model/definition/schema.ts"

/** Standard record fields; caller-owned metadata and aliases remain writable. */
const definitions = {
  aliases: schema.array(schema.string(), { label: "Aliases" }),
  metadata: schema.map(schema.string(), { label: "Metadata" }),
  etag: schema.string({ label: "ETag", outputOnly: true }),
  objectType: schema.string({ label: "Object type", outputOnly: true }),
  label: schema.string({
    label: "Label",
    description: "Current display label derived from the model.",
    outputOnly: true,
  }),
  id: schema.id({ id: "object" }, { label: "Record ID", outputOnly: true }),
  createdBy: schema.id(
    { id: "actor" },
    { label: "Created by", outputOnly: true }
  ),
  updatedBy: schema.id(
    { id: "actor" },
    { label: "Updated by", outputOnly: true }
  ),
  createdAt: schema.timestamp({ label: "Created at", outputOnly: true }),
  updatedAt: schema.timestamp({ label: "Updated at", outputOnly: true }),
  systemManaged: schema.boolean({
    label: "System managed",
    description:
      "Whether ordinary mutations are reserved for trusted system workflows.",
    outputOnly: true,
  }),
}

export type RecordPropertySchemas = typeof definitions

export const recordProperties: Readonly<Record<string, PropertyDefinition>> =
  normalizeProperties(definitions)
