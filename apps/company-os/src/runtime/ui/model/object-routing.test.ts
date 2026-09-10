import { isNotFound } from "@tanstack/react-router"
import { describe, expect, it } from "vitest"

import {
  AnonymousActor,
  ServiceAccount,
  User,
} from "#/runtime/access/model/index.ts"
import { Asset } from "#/runtime/assets/model/asset.ts"
import { ModuleSetting } from "#/runtime/platform/model/index.ts"
import { PlatformUi } from "#/runtime/platform/ui/index.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { createModelNavigation } from "#/runtime/ui/model/model-navigation.ts"
import {
  objectHref,
  objectRecordHref,
  routeObject,
  routeObjectAtPath,
} from "#/runtime/ui/model/object-routing.ts"

const presentation = testPresentation(fixtureModel, PlatformUi)

function notFoundThrownBy(resolve: () => unknown) {
  try {
    resolve()
    return false
  } catch (error) {
    return isNotFound(error)
  }
}

describe("object routes", () => {
  it("groups visible core destinations under Platform and keeps anonymous actors hidden", () => {
    const platform = createModelNavigation(presentation).find(
      ({ id }) => id === "platform"
    )
    expect(platform?.items.map(({ object }) => object.id)).toEqual([
      "user",
      "serviceAccount",
      "asset",
    ])
  })

  it("serves platform identities and assets in the main object routes", () => {
    expect(objectHref(presentation, User)).toBe("/objects/user")
    expect(objectHref(presentation, User, "u 1")).toBe("/objects/user/u%201")
    expect(routeObject(presentation, "serviceAccount")).toBe(ServiceAccount)
  })

  it("does not serve objects under /objects when they live elsewhere or have no pages", () => {
    expect(routeObject(presentation, "user")).toBe(User)
    expect(routeObject(presentation, "asset")).toBe(Asset)
    expect(
      notFoundThrownBy(() => routeObject(presentation, "moduleSetting"))
    ).toBe(true)
    expect(routeObjectAtPath(presentation, "/settings/modules")).toBe(
      ModuleSetting
    )
    expect(
      notFoundThrownBy(() => routeObject(presentation, "anonymousActor"))
    ).toBe(true)
    expect(
      notFoundThrownBy(() => routeObjectAtPath(presentation, "/settings/asset"))
    ).toBe(true)
    expect(notFoundThrownBy(() => routeObject(presentation, "missing"))).toBe(
      true
    )
  })

  it("keeps settings records linkable while hiding them from the workspace navigation", () => {
    expect(objectHref(presentation, ModuleSetting)).toBe("/settings/modules")
    expect(objectRecordHref(presentation, ModuleSetting, "module_sales")).toBe(
      "/settings/modules/module_sales"
    )
  })

  it("links references only to objects that have pages", () => {
    expect(objectRecordHref(presentation, User, "u1")).toBe("/objects/user/u1")
    expect(objectRecordHref(presentation, AnonymousActor, "a1")).toBeUndefined()
  })
})
