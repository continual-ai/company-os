import {
  containsSecret,
  type AnySchema,
} from "#/runtime/model/definition/schema.ts"

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {}
}

/** Omitted struct secrets survive updates. Replacing a union variant or a collection requires new credentials. */
export function preserveSecretInputs(
  schema: AnySchema,
  next: unknown,
  previous: unknown
): unknown {
  if (!containsSecret(schema)) return next
  if (schema.kind === "string" && schema.secret)
    return next === undefined ? previous : next
  if (schema.kind === "optional")
    return preserveSecretInputs(schema.value, next, previous)
  if (next === null || next === undefined) return next
  if (schema.kind === "struct") {
    const result = record(next)
    const before = record(previous)
    for (const [key, child] of Object.entries(schema.properties)) {
      const value = preserveSecretInputs(child, result[key], before[key])
      if (value !== undefined) result[key] = value
    }
    return result
  }
  if (schema.kind === "union" && schema.discriminator) {
    const tag = schema.discriminator
    const current = record(next)
    const before = record(previous)
    const member = schema.members.find(
      (candidate) =>
        candidate.kind === "struct" &&
        candidate.properties[tag]?.kind === "literal" &&
        candidate.properties[tag].value === current[tag]
    )
    return member
      ? preserveSecretInputs(
          member,
          next,
          before[tag] === current[tag] ? previous : undefined
        )
      : next
  }
  return next
}
