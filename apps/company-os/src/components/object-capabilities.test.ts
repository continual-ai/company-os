import { Model } from "@company/model"
import { describe, expect, it } from "vitest"

import { PLATFORM_ID } from "@/system-records"

import {
  allowedCapabilityKeys,
  objectCapabilityCheck,
  objectCapabilityChecks,
} from "./object-capabilities"

describe("object capabilities", () => {
  it("derives collection and record checks from model actions", () => {
    expect(objectCapabilityCheck(Model.objects.company, "create")).toEqual({
      permission: "company.create",
      target: PLATFORM_ID,
    })
    expect(objectCapabilityChecks(Model.objects.lead, ["lead_1"])).toEqual(
      expect.arrayContaining([
        { permission: "lead.create", target: PLATFORM_ID },
        { permission: "lead.update", target: "lead_1" },
        { permission: "lead.delete", target: "lead_1" },
        { permission: "lead.convert", target: "lead_1" },
      ])
    )
    expect(
      objectCapabilityChecks(Model.objects.invitation, ["invitation_1"])
    ).toEqual(
      expect.arrayContaining([
        { permission: "invitation.accept", target: "invitation_1" },
      ])
    )
  })

  it("keeps ordered responses aligned with their checks", () => {
    const checks = [
      { permission: "company.create", target: PLATFORM_ID },
      { permission: "company.update", target: "company_1" },
    ]
    const allowed = allowedCapabilityKeys(checks, [
      { allowed: true },
      { allowed: false },
    ])
    expect(allowed.has(`company.create\u0000${PLATFORM_ID}`)).toBe(true)
    expect(allowed.has("company.update\u0000company_1")).toBe(false)
    expect(() => allowedCapabilityKeys(checks, [])).toThrow(
      "Capability response does not match the request."
    )
  })
})
