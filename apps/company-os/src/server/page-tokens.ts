import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

import { PageToken, type PageTokenCodec } from "@company/runtime"
import { Context, Effect, Layer } from "effect"

import { ApplicationKeys } from "./application-keys"

const VERSION = 1
const NONCE_BYTES = 12
const AUTH_TAG_BYTES = 16
const AAD = Buffer.from("company-os:page-token:v1")
const KEY_BYTES = 32
const KEY_PURPOSE = "company-os:page-token:aes-256-gcm:v1"

class PageTokenConfigurationError extends Error {
  override readonly name = "PageTokenConfigurationError"
}

/** Encrypts adapter cursor state so callers cannot inspect or forge it. */
export function makeEncryptedPageTokenCodec(
  key: Readonly<Uint8Array>
): PageTokenCodec {
  if (key.byteLength !== KEY_BYTES) {
    throw new PageTokenConfigurationError(
      "Page-token encryption requires a 32-byte key."
    )
  }
  return {
    encode(value) {
      const nonce = randomBytes(NONCE_BYTES)
      const cipher = createCipheriv("aes-256-gcm", key, nonce)
      cipher.setAAD(AAD)
      const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
      ])
      const authTag = cipher.getAuthTag()
      return PageToken(
        Buffer.concat([
          Buffer.from([VERSION]),
          nonce,
          authTag,
          encrypted,
        ]).toString("base64url")
      )
    },
    decode(token) {
      const encoded = Buffer.from(token, "base64url")
      if (encoded.length <= 1 + NONCE_BYTES + AUTH_TAG_BYTES) {
        throw new Error("The page token is invalid.")
      }
      const version = encoded[0]
      if (version !== VERSION) throw new Error("The page token is invalid.")
      const nonce = encoded.subarray(1, 1 + NONCE_BYTES)
      const authTag = encoded.subarray(
        1 + NONCE_BYTES,
        1 + NONCE_BYTES + AUTH_TAG_BYTES
      )
      const encrypted = encoded.subarray(1 + NONCE_BYTES + AUTH_TAG_BYTES)
      const decipher = createDecipheriv("aes-256-gcm", key, nonce)
      decipher.setAAD(AAD)
      decipher.setAuthTag(authTag)
      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString("utf8")
    },
  }
}

const make = Effect.gen(function* () {
  const applicationKeys = yield* ApplicationKeys
  return makeEncryptedPageTokenCodec(applicationKeys.deriveKey(KEY_PURPOSE))
})

/** Application-owned continuation-token protection supplied to storage adapters. */
export class PageTokens extends Context.Service<PageTokens>()(
  "@company/PageTokens",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(ApplicationKeys.layer)
  )
  static readonly layerTest = Layer.effect(this, this.make).pipe(
    Layer.provide(ApplicationKeys.layerTest)
  )
}
