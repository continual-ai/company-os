import { isNotFound } from "@tanstack/react-router"
import { describe, expect, it } from "vitest"

import {
  AnonymousActor,
  RoleAssignment,
  User,
} from "#/runtime/access/model/index.ts"
import { AccessUi } from "#/runtime/access/ui/index.ts"
import { AssetsUi } from "#/runtime/assets/ui/index.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import {
  objectHref,
  objectRecordHref,
  routeObject,
  routeObjectAtPath,
} from "#/runtime/ui/model/object-routing.ts"

const presentation = testPresentation(fixtureModel, AccessUi, AssetsUi)

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
    expect(objectHref(presentation, User)).toBe("/settings/users")
    expect(objectHref(presentation, User, "u 1")).toBe("/settings/users/u%201")
    expect(routeObjectAtPath(presentation, "/settings/role-assignments")).toBe(
      RoleAssignment
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
    expect(objectRecordHref(presentation, User, "u1")).toBe(
      "/settings/users/u1"
    )
    expect(objectRecordHref(presentation, AnonymousActor, "a1")).toBeUndefined()
  })
})
