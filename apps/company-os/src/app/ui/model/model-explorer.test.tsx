import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import { ModelExplorer } from "#/app/ui/developer/model-explorer.tsx"

it("shows link traversals and inherited interface relationships on concrete objects", () => {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
  const html = renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <ModelExplorer model={Model} selectedItem="object:contact" />
    </RouterContextProvider>
  )
  const detail = html.slice(html.indexOf("<article"))
  expect(detail).toContain(">Tickets</p>")
  expect(detail).toContain(">Notes</p>")
  expect(detail).toContain("link")
})
