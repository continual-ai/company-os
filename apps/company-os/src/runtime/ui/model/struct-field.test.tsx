import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { defineObject, schema } from "#/runtime/model/index.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { ObjectPropertiesCard } from "#/runtime/ui/model/object-properties-card.tsx"
import { objectPropertyValue } from "#/runtime/ui/model/object-property-value.tsx"
import { ModelUiProvider } from "#/runtime/ui/model/runtime-context.tsx"

const runtime = testPresentation(fixtureModel)

it("renders JSON values without treating null and empty collections as absent", () => {
  for (const value of [null, [], {}, false, 0]) {
    const html = renderToStaticMarkup(
      <>{objectPropertyValue(runtime, schema.json(), value, new Map())}</>
    )
    expect(html).toContain(JSON.stringify(value))
    expect(html).not.toContain("Empty")
  }
  expect(
    renderToStaticMarkup(
      <>
        {objectPropertyValue(
          runtime,
          schema.optional(schema.json()),
          null,
          new Map()
        )}
      </>
    )
  ).toContain("null")
})

const Example = defineObject({
  id: "structExample",
  collection: "structExamples",
  name: "Struct example",
  pluralName: "Struct examples",
  properties: {
    name: schema.string(),
    sync: schema.object(
      {
        status: schema.select({
          label: "Status",
          options: [{ value: "current", label: "Up to date", color: "green" }],
        }),
        completedAt: schema.timestamp({ label: "Last completed" }),
        source: schema.url({ label: "Source" }),
        checkpoint: schema.object(
          {
            page: schema.number({ label: "Page" }),
            hasMore: schema.boolean({ label: "More pages" }),
            error: schema.string({ label: "Last error", nullable: true }),
          },
          { label: "Checkpoint" }
        ),
      },
      { label: "Sync", outputOnly: true }
    ),
  },
  display: { title: "name" },
})

const record = {
  id: "example",
  etag: "1",
  name: "Repository",
  sync: {
    status: "current",
    completedAt: "2026-09-17T19:00:00Z",
    source: "https://github.com/example/repository",
    checkpoint: { page: 0, hasMore: false, error: null },
  },
}

const example = (
  <ModelUiProvider value={runtime}>
    <ObjectPropertiesCard
      object={Example}
      record={record}
      fields={["sync"]}
      references={new Map()}
      onEdit={() => undefined}
    />
  </ModelUiProvider>
)

it("renders nested struct leaves with their normal formatting and preserves read-only behavior", () => {
  const html = renderToStaticMarkup(example)
  expect(html).toContain("Up to date")
  expect(html).toContain('<time dateTime="2026-09-17T19:00:00.000Z"')
  expect(html).toContain('href="https://github.com/example/repository"')
  expect(html).toContain("Checkpoint")
  expect(html).toMatch(/>0<\/dd>/)
  expect(html).toMatch(/>No<\/dd>/)
  expect(html).toContain("Empty")
  expect(html).not.toContain("Edit Sync")
  expect(html).not.toContain("Edit Checkpoint")
})

it("renders optional structs and arrays of union members without exposing secrets", () => {
  const property = schema.optional(
    schema.object({
      entries: schema.array(
        schema.discriminatedUnion("kind", [
          schema.object({
            kind: schema.literal("credential"),
            token: schema.secret(),
            email: schema.email(),
          }),
          schema.object({ kind: schema.literal("empty") }),
        ])
      ),
    })
  )
  const html = renderToStaticMarkup(
    <>
      {objectPropertyValue(
        runtime,
        property,
        {
          entries: [
            {
              kind: "credential",
              token: "must-not-render",
              email: "a@example.com",
            },
            {
              kind: "credential",
              token: { hint: "ends in 1234" },
              email: null,
            },
          ],
        },
        new Map()
      )}
    </>
  )
  expect(html).toContain('href="mailto:a@example.com"')
  expect(html).toContain("Set")
  expect(html).toContain("ends in 1234")
  expect(html).not.toContain("must-not-render")
})
