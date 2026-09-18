import { Effect } from "effect"
import { expect } from "vitest"

import {
  defineModel,
  defineModule,
  defineObject,
  schema,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { operationsFor } from "#/runtime/server/operation-executor.ts"
import { createRecordSearch } from "#/runtime/server/record-search.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const Document = defineObject({
  id: "document",
  collection: "documents",
  name: "Document",
  pluralName: "Documents",
  properties: {
    title: schema.string(),
    content: schema.markdown({ nullable: true }),
  },
  display: { title: "title" },
  search: { fields: ["title", "content"] },
})
const model = defineModel({
  name: "Search",
  modules: [
    PlatformModule,
    defineModule({ id: "documents", name: "Documents", objects: [Document] }),
  ],
})
const fixture = testFoundation(model)

fixture.test(
  "searches narrative fields with bounded snippets and query-bound keyset pagination",
  () =>
    Effect.gen(function* () {
      const { document } = yield* operationsFor(model)
      const search = createRecordSearch(model)
      const ids: string[] = []
      for (let index = 0; index < 5; index++) {
        const doc = yield* document.create({
          title: "Same title",
          content: `${"ordinary text ".repeat(100)}metronome usage billing ${"later context ".repeat(100)}`,
        })
        ids.push(doc.id)
      }
      const page = yield* search({ query: "metronome", pageSize: 2 })
      expect(page.items).toHaveLength(2)
      expect(page.totalSize).toBe(5)
      expect(page.totalSizeExact).toBe(true)
      for (const hit of page.items) {
        expect(hit.snippets).toHaveLength(1)
        expect(hit.snippets[0]?.field).toBe("content")
        expect(hit.snippets[0]?.text).toContain("metronome")
        expect(Array.from(hit.snippets[0]!.text).length).toBeLessThanOrEqual(
          250
        )
        expect(hit.snippets[0]?.text).not.toContain("<b>")
        expect(hit).not.toHaveProperty("content")
      }
      expect(page.nextPageToken).not.toBeNull()
      const second = yield* search({
        query: "metronome",
        pageSize: 2,
        pageToken: page.nextPageToken!,
      })
      const third = yield* search({
        query: "metronome",
        pageSize: 2,
        pageToken: second.nextPageToken!,
      })
      expect(third.nextPageToken).toBeNull()
      expect(second.totalSize).toBe(5)
      expect(third.totalSize).toBe(5)
      expect(third.items).toHaveLength(1)
      for (const pageSize of [0, 1000]) {
        const all = yield* search({ query: "metronome", pageSize })
        expect(all.items).toHaveLength(5)
        expect(all.totalSize).toBe(5)
        expect(all.nextPageToken).toBeNull()
      }
      for (const input of [
        { query: "" },
        { query: "nonexistent" },
        { query: "metronome", objectTypes: [] },
      ]) {
        expect(yield* search(input)).toEqual({
          items: [],
          nextPageToken: null,
          totalSize: 0,
          totalSizeExact: true,
        })
      }
      expect(
        [...page.items, ...second.items, ...third.items].map((hit) => hit.id)
      ).toEqual(ids.sort())
      for (const changed of [
        { query: "billing" },
        { query: "" },
        { query: "metronome", objectTypes: [] },
        { query: "metronome", objectTypes: ["document"] },
      ]) {
        const error = yield* Effect.flip(
          search({ ...changed, pageToken: page.nextPageToken! })
        )
        expect(error).toMatchObject({ _tag: "InvalidListRequest" })
      }
      const punctuation = yield* document.create({
        title: "Contact detail",
        content: "Please contact ada@example.test for billing questions",
      })
      const email = yield* search({ query: "ada@example.test" })
      expect(email.totalSize).toBe(1)
      expect(email.items[0]?.id).toBe(punctuation.id)
      expect(email.items[0]?.snippets[0]?.text).toContain("ada")
      const titleOnly = yield* search({ query: "Contact" })
      expect(titleOnly.items[0]?.snippets.length).toBeLessThanOrEqual(3)
    })
)
