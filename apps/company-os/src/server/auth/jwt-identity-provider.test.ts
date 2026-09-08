import { Effect } from "effect"
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose"
import { expect, it } from "vitest"

import { makeJwtIdentityProvider } from "#/server/auth/jwt-identity-provider.ts"

it("verifies signature, issuer, audience and expiry while keeping local permissions independent", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256")
  const key = await exportJWK(publicKey)
  const provider = makeJwtIdentityProvider({
    issuer: "https://identity.example",
    audience: "company",
    resolveKey: createLocalJWKSet({ keys: [key] }),
  })
  const token = (
    issuer = "https://identity.example",
    audience = "company",
    expires = "5m"
  ) =>
    new SignJWT({
      name: "Ada",
      email: "ada@example.test",
      roles: ["administrator"],
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("ada")
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expires)
      .sign(privateKey)
  const identify = (value: string) =>
    Effect.runPromise(
      provider.identify(new Headers({ authorization: `Bearer ${value}` }))
    )
  expect(await Effect.runPromise(provider.identify(new Headers()))).toBeNull()
  expect(await identify(await token())).toEqual({
    actor: {
      issuer: "https://identity.example",
      subject: "ada",
      name: "Ada",
      email: "ada@example.test",
      kind: "user",
    },
    authorizationSubject: {
      issuer: "https://identity.example",
      subject: "ada",
      name: "Ada",
      email: "ada@example.test",
      kind: "user",
    },
  })
  for (const invalid of [
    await token("https://wrong.example"),
    await token(undefined, "another-app"),
    await token(undefined, undefined, "-1h"),
    "not.a.token",
  ])
    await expect(identify(invalid)).rejects.toThrow()
  const other = await generateKeyPair("RS256")
  const forged = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setSubject("ada")
    .setIssuer("https://identity.example")
    .setAudience("company")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(other.privateKey)
  await expect(identify(forged)).rejects.toThrow()
})
