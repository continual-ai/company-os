import { Model } from "company-os/model"
import { describe, expect, it } from "vitest"

import {
  allowedCapabilityKeys,
  capabilityKey,
  type CapabilityCheck,
} from "@/capabilities"
import { ROOT_ID } from "@/system-records"

import {
  objectCapabilityCheck,
  objectCapabilityChecks,
} from "./object-capabilities"

describe("object capabilities", () => {
  it("derives collection and record checks from model actions", () => {
    expect(objectCapabilityCheck(Model.objects.company, "create")).toEqual({
      permission: "company.create",
      target: ROOT_ID,
    })
    expect(objectCapabilityChecks(Model.objects.lead, ["lead_1"])).toEqual(
      expect.arrayContaining([
        { permission: "lead.create", target: ROOT_ID },
        { permission: "lead.update", target: "lead_1" },
        { permission: "lead.delete", target: "lead_1" },
        { permission: "lead.convert", target: "lead_1" },
      ])
    )
  })

  it("keeps ordered responses aligned with their checks", () => {
    const checks = [
      { permission: "company.create", target: ROOT_ID },
      { permission: "company.update", target: "company_1" },
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
