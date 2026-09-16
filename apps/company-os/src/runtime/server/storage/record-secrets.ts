import { Buffer } from "node:buffer"
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

import { Context, Effect, Layer, Redacted } from "effect"

import {
  containsSecret,
  type AnySchema,
} from "#/runtime/model/definition/schema.ts"
import type { ObjectType } from "#/runtime/model/index.ts"
import { ApplicationKeys } from "#/runtime/server/application-keys.ts"

interface Envelope {
  readonly ciphertext: string
  readonly version: 1
}

function objectValue(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Invalid protected record value.")
  return Object.fromEntries(Object.entries(value))
}

/** Walk only declared secret leaves; discriminators select the active variant. */
export function mapSecrets(
  schema: AnySchema,
  value: unknown,
  path: ReadonlyArray<string>,
  visit: (value: unknown, path: ReadonlyArray<string>) => unknown
): unknown {
  if (value === null || value === undefined || !containsSecret(schema))
    return value
  if (schema.kind === "string" && schema.secret) return visit(value, path)
  if (schema.kind === "optional")
    return mapSecrets(schema.value, value, path, visit)
  if (schema.kind === "array" && Array.isArray(value))
    return value.map((item, index) =>
      mapSecrets(schema.items, item, [...path, String(index)], visit)
    )
  if (schema.kind === "map")
    return Object.fromEntries(
      Object.entries(objectValue(value)).map(([key, item]) => [
        key,
        mapSecrets(schema.values, item, [...path, key], visit),
      ])
    )
  if (schema.kind === "struct") {
    const result = objectValue(value)
    for (const [key, child] of Object.entries(schema.properties))
      if (key in result)
        result[key] = mapSecrets(child, result[key], [...path, key], visit)
    return result
  }
  if (schema.kind === "union" && schema.discriminator) {
    const source = objectValue(value)
    const tag = schema.discriminator
    const member = schema.members.find(
      (candidate) =>
        candidate.kind === "struct" &&
        candidate.properties[tag]?.kind === "literal" &&
        candidate.properties[tag].value === source[tag]
    )
    if (member) return mapSecrets(member, value, path, visit)
  }
  throw new Error("Unsupported protected record value.")
}

function mapRecord(
  object: ObjectType,
  value: object,
  visit: (value: unknown, path: ReadonlyArray<string>) => unknown
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const schema = object.properties[key]
      return [key, schema ? mapSecrets(schema, item, [key], visit) : item]
    })
  )
}

/** Public records contain presence only. Ciphertext never enters snapshots or transport codecs. */
export function redactRecordSecrets(object: ObjectType, value: object) {
  return mapRecord(object, value, () => ({ hint: null }))
}

const aad = (object: ObjectType, id: string, path: ReadonlyArray<string>) =>
  Buffer.from(JSON.stringify([object.id, id, path]))

const make = Effect.gen(function* () {
  const keys = yield* ApplicationKeys
  const key = keys.deriveKey("record-secrets:v1")
  const encrypt = (object: ObjectType, id: string, properties: object) =>
    mapRecord(object, properties, (value, path): Envelope => {
      if (typeof value !== "string")
        throw new Error("Expected a secret string.")
      const nonce = randomBytes(12)
      const cipher = createCipheriv("aes-256-gcm", key, nonce)
      cipher.setAAD(aad(object, id, path))
      const bytes = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
      ])
      return {
        version: 1,
        ciphertext: Buffer.concat([nonce, cipher.getAuthTag(), bytes]).toString(
          "base64"
        ),
      }
    })
  const decrypt = (
    object: ObjectType,
    id: string,
    path: ReadonlyArray<string>,
    value: unknown
  ) => {
    const envelope = objectValue(value)
    if (envelope.version !== 1 || typeof envelope.ciphertext !== "string")
      throw new Error("Invalid protected record value.")
    const bytes = Buffer.from(envelope.ciphertext, "base64")
    if (bytes.length < 28) throw new Error("Invalid protected record value.")
    const cipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12))
    cipher.setAAD(aad(object, id, path))
    cipher.setAuthTag(bytes.subarray(12, 28))
    return Redacted.make(
      Buffer.concat([
        cipher.update(bytes.subarray(28)),
        cipher.final(),
      ]).toString("utf8")
    )
  }
  const reveal = (object: ObjectType, id: string, values: object) =>
    mapRecord(object, values, (value, path) =>
      Redacted.value(decrypt(object, id, path, value))
    )
  return { encrypt, decrypt, reveal }
})

/** Storage codec; encryption stays inside record transactions and uses a purpose-specific APP_SECRET key. */
export class RecordSecrets extends Context.Service<RecordSecrets>()(
  "@company/RecordSecrets",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
