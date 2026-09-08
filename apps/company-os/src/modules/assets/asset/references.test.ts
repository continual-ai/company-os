import { defineObject, schema } from "@company/runtime"
import { expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import { compileAssetReferences } from "#/modules/assets/asset/references.ts"

it("discovers nested file usages and selects only the matching union branch", () => {
  const object = defineObject({
    id: "document",
    collection: "documents",
    name: "Document",
    pluralName: "Documents",
    display: { title: "name" },
    parent: Model.root,
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
  expect(compileAssetReferences(Model.objects.role)).toBeUndefined()
})
