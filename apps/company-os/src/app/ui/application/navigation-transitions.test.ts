import { afterEach, expect, it, vi } from "vitest"

import { navigationTransitionTypes } from "#/app/ui/application/navigation-transitions.ts"

afterEach(() => vi.unstubAllGlobals())

function browser(reducedMotion = false) {
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: reducedMotion }),
  })
}

it("fades page navigation and tab navigation at separate boundaries", () => {
  browser()
  expect(
    navigationTransitionTypes({
      pathChanged: true,
      fromLocation: { search: {} },
      toLocation: { search: {} },
    })
  ).toEqual(["page"])
  expect(
    navigationTransitionTypes({
      pathChanged: false,
      fromLocation: { search: {} },
      toLocation: { search: { tab: "notes" } },
    })
  ).toEqual(["tab"])
  expect(
    navigationTransitionTypes({
      pathChanged: false,
      fromLocation: { search: { tab: "notes" } },
      toLocation: { search: {} },
    })
  ).toEqual(["tab"])
})

it("keeps search, filters, pagination, and equivalent default tabs instant", () => {
  browser()
  for (const search of [
    { search: "Acme" },
    { page: 2 },
    { sort: "name" },
    { tab: "overview" },
  ]) {
    expect(
      navigationTransitionTypes({
        pathChanged: false,
        fromLocation: { search: {} },
        toLocation: { search },
      })
    ).toBe(false)
  }
})

it("skips initial loads, server rendering, and reduced motion", () => {
  vi.stubGlobal("window", undefined)
  const navigation = {
    pathChanged: true,
    fromLocation: { search: {} },
    toLocation: { search: {} },
  }
  expect(navigationTransitionTypes(navigation)).toBe(false)
  browser()
  expect(
    navigationTransitionTypes({ pathChanged: true, toLocation: { search: {} } })
  ).toBe(false)
  browser(true)
  expect(navigationTransitionTypes(navigation)).toBe(false)
})
