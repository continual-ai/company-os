import { expect, it } from "vitest"

import { ServiceAccount } from "#/runtime/access/model/index.ts"
import { compileAssetReferences } from "#/runtime/assets/server/references.ts"
import { defineObject, Root, schema } from "#/runtime/model/index.ts"

it("discovers nested file usages and selects only the matching union branch", () => {
  const object = defineObject({
    id: "document",
    collection: "documents",
    name: "Document",
    pluralName: "Documents",
    display: { title: "name" },
    parent: Root,
    properties: {
      name: schema.string(),
      details: schema.object({ attachments: schema.array(schema.file()) }),
      localized: schema.map(schema.image()),
      source: schema.union([schema.string(), schema.file()]),
    },
  })
  expect(
    compileAssetReferences(object)!({
      details: { attachments: [{ assetId: "file_one" }] },
      localized: { en: { assetId: "file_two", alt: "Image" } },
      source: { assetId: "file_three" },
    }).map(({ field, assetId }) => ({ field, assetId }))
  ).toEqual([
    { field: "details.attachments.0", assetId: "file_one" },
    { field: "localized.en", assetId: "file_two" },
    { field: "source", assetId: "file_three" },
  ])
  expect(
    compileAssetReferences(object)!({ source: "external content" })
  ).toEqual([])
})

it("does not install asset behavior for objects without file fields", () => {
  expect(compileAssetReferences(ServiceAccount)).toBeUndefined()
})
