import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { schema } from "#/runtime/model/index.ts"
import { fixtureModel, Account } from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { objectPropertyValue } from "#/runtime/ui/model/object-property-value.tsx"
import { RecordLinkValue } from "#/runtime/ui/model/record-link-value.tsx"
import { ModelUiProvider } from "#/runtime/ui/model/runtime-context.tsx"

const router = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory({ initialEntries: ["/"] }),
})

const runtime = testPresentation(fixtureModel)
const references = new Map([
  [
    "account-example",
    { object: Account, record: { id: "account-example", name: "Northstar" } },
  ],
])
const render = (value: Parameters<typeof RecordLinkValue>[0]["value"]) =>
  renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <ModelUiProvider value={runtime}>
        <RecordLinkValue
          value={value}
          resolveRecord={(id) => references.get(id)}
        />
      </ModelUiProvider>
    </RouterContextProvider>
  )

it("renders raw and expanded links with the same record identity", () => {
  const raw = render("account-example")
  expect(raw).toContain("Northstar")
  expect(render({ id: "account-example" })).toBe(raw)
  expect(
    render({ ids: ["account-example"], totalSize: 1, totalSizeExact: true })
  ).toBe(raw)
  expect(
    render({
      items: [{ id: "account-example" }],
      totalSize: 1,
      totalSizeExact: true,
    })
  ).toBe(raw)
  expect(
    renderToStaticMarkup(
      <RouterContextProvider router={router}>
        <ModelUiProvider value={runtime}>
          {objectPropertyValue(schema.id(Account), "account-example", (id) =>
            references.get(id)
          )}
        </ModelUiProvider>
      </RouterContextProvider>
    )
  ).toBe(raw)
})

it("shares empty values and preserves bounded counts and unresolved identities", () => {
  expect(render(null)).toContain("Empty")
  expect(render({ ids: [], totalSize: 0, totalSizeExact: true })).toBe(
    render(null)
  )
  expect(
    renderToStaticMarkup(
      <>
        {objectPropertyValue(schema.string(), null, (id) => references.get(id))}
      </>
    )
  ).toBe(render(null))
  expect(
    render({ ids: ["account-example"], totalSize: 1000, totalSizeExact: false })
  ).toContain("999+")
  expect(render("unresolved-record")).toContain("unresolved-record")
})
