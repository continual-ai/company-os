import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

export function generateSecret(): string {
  return randomBytes(32).toString("base64url")
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex")
}

export function secretMatches(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSecret(secret), "hex")
  const expected = Buffer.from(expectedHash, "hex")
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
