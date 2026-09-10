import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { defineObject, schema } from "#/runtime/model/index.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { objectPropertyValue } from "#/runtime/ui/model/object-property-value.tsx"
import { ObjectTableCell } from "#/runtime/ui/model/object-table/object-table-cell.tsx"

const Article = defineObject({
  id: "article",
  collection: "articles",
  name: "Article",
  pluralName: "Articles",
  properties: {
    title: schema.string(),
    body: schema.markdown({ label: "Body", nullable: true }),
  },
  display: { title: "title" },
})

it("renders prose in record fields and plain previews in cells without executing embedded HTML", () => {
  const source = "**Decision**\n\n- Reviewed\n\n<script>alert(1)</script>"
  const field = renderToStaticMarkup(
    <>
      {objectPropertyValue(
        testPresentation(fixtureModel),
        Article,
        "body",
        source,
        new Map()
      )}
    </>
  )
  const cell = renderToStaticMarkup(
    <ObjectTableCell
      active={false}
      editing={false}
      expandActive={false}
      property={Article.properties.body}
      value={source}
      onCancelEditing={() => undefined}
      onEditingChange={() => undefined}
    />
  )
  expect(field).toContain("<strong>Decision</strong>")
  expect(field).toContain("<li>Reviewed</li>")
  expect(cell).toContain('data-slot="markdown-text"')
  expect(cell).toContain("Decision")
  expect(cell).toContain("Reviewed")
  expect(cell).not.toMatch(/<(p|ul|li|strong)\b/)
  for (const html of [field, cell]) {
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("**Decision**")
  }
})
