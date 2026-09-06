import { Model } from "company-os/model"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { ModelExplorer } from "./model-explorer"

it("shows reference inverses and inherited interface relationships on concrete objects", () => {
  const html = renderToStaticMarkup(
    <ModelExplorer model={Model} selectedItem="object:contact" />
  )
  const detail = html.slice(html.indexOf("<article"))
  expect(detail).toContain(">Tickets</p>")
  expect(detail).toContain(">Notes</p>")
  expect(detail).toContain("reference")
})
