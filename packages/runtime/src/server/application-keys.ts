import { Buffer } from "node:buffer"
import { hkdfSync } from "node:crypto"

import { Config, Context, Effect, Layer, Redacted } from "effect"

const MINIMUM_SECRET_BYTES = 32
const KEY_BYTES = 32
const KEY_DERIVATION_SALT = Buffer.from("company-os:application-keys:v1")

class ApplicationSecretConfigurationError extends Error {
  override readonly name = "ApplicationSecretConfigurationError"
}

export interface ApplicationKeyDeriver {
  readonly deriveKey: (purpose: string) => Buffer
}

/** Derives isolated keys so one application secret is never reused directly. */
export function makeApplicationKeys(secret: string): ApplicationKeyDeriver {
  const secretBytes = Buffer.from(secret, "utf8")
  if (secretBytes.length < MINIMUM_SECRET_BYTES) {
    throw new ApplicationSecretConfigurationError(
      "APP_SECRET must contain at least 32 bytes."
    )
  }

  return {
    deriveKey(purpose) {
      if (purpose.length === 0) {
        throw new ApplicationSecretConfigurationError(
          "Application key purposes must be non-empty."
        )
      }
      return Buffer.from(
        hkdfSync(
          "sha256",
          secretBytes,
          KEY_DERIVATION_SALT,
          Buffer.from(purpose, "utf8"),
          KEY_BYTES
        )
      )
    },
  }
}

const make = Effect.gen(function* () {
  const secret = yield* Config.redacted("APP_SECRET")
  return makeApplicationKeys(Redacted.value(secret))
})

/** Purpose-separated server cryptographic keys derived from `APP_SECRET`. */
export class ApplicationKeys extends Context.Service<ApplicationKeys>()(
  "@company/ApplicationKeys",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
  static readonly layerTest = Layer.succeed(
    this,
    makeApplicationKeys(
      "company-os-test-application-secret-do-not-use-in-production"
    )
  )
}
