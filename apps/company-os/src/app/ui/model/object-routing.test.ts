import { isNotFound } from "@tanstack/react-router"
import { describe, expect, it } from "vitest"

import { EnabledModel } from "#/app.model.ts"
import { presentation } from "#/app/app-presentation.ts"
import {
  objectHref,
  objectRecordHref,
  routeObject,
  routeObjectAtPath,
} from "#/runtime/ui/model/object-routing.ts"

function notFoundThrownBy(resolve: () => unknown) {
  try {
    resolve()
    return false
  } catch (error) {
    return isNotFound(error)
  }
}

describe("object routes", () => {
  it("serves access collections and records under their settings path", () => {
    expect(objectHref(presentation, EnabledModel.objects.user)).toBe(
      "/settings/users"
    )
    expect(objectHref(presentation, EnabledModel.objects.user, "u 1")).toBe(
      "/settings/users/u%201"
    )
    expect(routeObjectAtPath(presentation, "/settings/role-assignments")).toBe(
      EnabledModel.objects.roleAssignment
    )
  })

  it("does not serve objects under /objects when they live elsewhere or have no pages", () => {
    expect(notFoundThrownBy(() => routeObject(presentation, "user"))).toBe(true)
    expect(notFoundThrownBy(() => routeObject(presentation, "asset"))).toBe(
      true
    )
    expect(
      notFoundThrownBy(() => routeObjectAtPath(presentation, "/settings/asset"))
    ).toBe(true)
    expect(notFoundThrownBy(() => routeObject(presentation, "missing"))).toBe(
      true
    )
  })

  it("links references only to objects that have pages", () => {
    expect(
      objectRecordHref(presentation, EnabledModel.objects.user, "u1")
    ).toBe("/settings/users/u1")
    expect(
      objectRecordHref(presentation, EnabledModel.objects.anonymousActor, "a1")
    ).toBeUndefined()
  })
})
