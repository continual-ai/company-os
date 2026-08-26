import { Model } from "@company/model"
import { describe, expect, it } from "vitest"

import { allowedCapabilityKeys } from "@/capabilities"
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
    ]
    const allowed = allowedCapabilityKeys(checks, [
      { allowed: true },
      { allowed: false },
    ])
    expect(allowed.has(`company.create\u0000${ROOT_ID}`)).toBe(true)
    expect(allowed.has("company.update\u0000company_1")).toBe(false)
    expect(() => allowedCapabilityKeys(checks, [])).toThrow(
      "Capability response does not match the request."
    )
  })
})
