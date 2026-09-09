import { describe, expect, it } from "vitest"

import {
  allowedCapabilityKeys,
  capabilityKey,
  type CapabilityCheck,
} from "#/runtime/client/capabilities.ts"
import { ROOT_ID } from "#/runtime/model/system-records.ts"
import {
  Account,
  fixtureModel,
  Prospect,
} from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import {
  objectCapabilityCheck,
  objectCapabilityChecks,
} from "#/runtime/ui/model/object-capabilities.ts"

const presentation = testPresentation(fixtureModel)

describe("object capabilities", () => {
  it("derives collection and record checks from model actions", () => {
    expect(objectCapabilityCheck(presentation, Account, "create")).toEqual({
      permission: "account.create",
      target: ROOT_ID,
    })
    expect(
      objectCapabilityChecks(presentation, Prospect, ["prospect_1"])
    ).toEqual(
      expect.arrayContaining([
        { permission: "prospect.create", target: ROOT_ID },
        { permission: "prospect.update", target: "prospect_1" },
        { permission: "prospect.delete", target: "prospect_1" },
        { permission: "prospect.convert", target: "prospect_1" },
      ])
    )
  })

  it("keeps ordered responses aligned with their checks", () => {
    const checks = [
      { permission: "account.create", target: ROOT_ID },
      { permission: "account.update", target: "account_1" },
    ] as const satisfies ReadonlyArray<CapabilityCheck>
    const allowed = allowedCapabilityKeys(checks, [
      { allowed: true },
      { allowed: false },
    ])
    expect(allowed.has(capabilityKey(checks[0]))).toBe(true)
    expect(allowed.has(capabilityKey(checks[1]))).toBe(false)
    // HTML parsing replaces raw null characters in streamed hydration payloads.
    expect([...allowed].every((key) => !key.includes("\u0000"))).toBe(true)
    expect(() => allowedCapabilityKeys(checks, [])).toThrow(
      "Capability response does not match the request."
    )
  })
})
