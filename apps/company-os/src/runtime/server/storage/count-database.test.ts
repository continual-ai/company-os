import { Effect } from "effect"
import { expect } from "vitest"

import { modelObjectLinkTraversals, RecordId } from "#/runtime/model/index.ts"
import { SYSTEM_SERVICE_ACCOUNT_ID } from "#/runtime/model/system-records.ts"
import { operationsFor } from "#/runtime/server/operation-executor.ts"
import { createRecordSearch } from "#/runtime/server/record-search.ts"
import { recordSearch } from "#/runtime/server/storage/infrastructure.ts"
import { Links } from "#/runtime/server/storage/link-store.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { FixtureServer } from "#/runtime/testing/fixture-server.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const fixture = testFoundation(fixtureModel, { servers: [FixtureServer] })

fixture.test(
  "caps summaries without truncating object, link, interface, or search pages",
  () =>
    Effect.gen(function* () {
      const database = yield* SqlDatabase
      const { sql } = database
      const services = yield* operationsFor(fixtureModel)
      const links = yield* Links
      const peopleLink = modelObjectLinkTraversals(
        fixtureModel,
        fixtureModel.objects.account
      ).find(({ traversal }) => traversal.key === "people")!
      const topicsLink = modelObjectLinkTraversals(
        fixtureModel,
        fixtureModel.objects.memo
      ).find(({ traversal }) => traversal.key === "topics")!
      const account = yield* services.account.create({ name: "Parent" })
      const memo = yield* services.memo.create({ content: "Topics" })
      const { objects } = fixture.storage.core
      const people = fixture.storage.objects.person
      const seed = (start: number, end: number) =>
        database.transaction(() =>
          Effect.gen(function* () {
            // Bulk fixtures exercise real SQL limits without thousands of unrelated mutation operations.
            yield* sql`insert into ${objects} (id, object_type, created_by_id, updated_by_id)
        select 'person_count_' || n, 'person', ${SYSTEM_SERVICE_ACCOUNT_ID}, ${SYSTEM_SERVICE_ACCOUNT_ID}
        from generate_series(${start}::integer, ${end}::integer) n`
            yield* sql`insert into ${people} (id, name, consent)
        select 'person_count_' || n, 'Counted ' || n, 'unknown' from generate_series(${start}::integer, ${end}::integer) n`
            for (const table of [
              fixture.storage.interfaces.participant,
              fixture.storage.interfaces.topic,
            ])
              yield* sql`insert into ${table} (id) select 'person_count_' || n from generate_series(${start}::integer, ${end}::integer) n`
            yield* sql`insert into ${fixture.storage.linkTables.personAccounts} (forward_id, reverse_id)
        select 'person_count_' || n, ${account.id} from generate_series(${start}::integer, ${end}::integer) n`
            yield* sql`insert into ${fixture.storage.linkTables.memoTopics} (forward_id, reverse_id)
        select ${memo.id}, 'person_count_' || n from generate_series(${start}::integer, ${end}::integer) n`
            yield* sql`insert into ${recordSearch} (id, title, document)
        select 'person_count_' || n, 'Counted ' || n, to_tsvector('simple', 'Counted ' || n)
        from generate_series(${start}::integer, ${end}::integer) n`
          })
        )
      const search = createRecordSearch(fixtureModel)
      for (const [start, end, totalSizeExact] of [
        [1, 999, true],
        [1000, 1000, true],
        [1001, 1005, false],
      ] as const) {
        yield* seed(start, end)
        const summary = { totalSize: Math.min(end, 1000), totalSizeExact }
        const record = yield* services.account.get({ id: account.id })
        expect(record.links.people).toMatchObject(summary)
        expect(record.links.people.ids).toHaveLength(3)
        expect(
          (yield* services.account.get({
            id: account.id,
            expand: { people: true },
          })).links.people
        ).toMatchObject(summary)
        expect(yield* services.person.list({ pageSize: 10 })).toMatchObject(
          summary
        )
        expect(
          yield* links.list(peopleLink, { id: account.id, pageSize: 10 })
        ).toMatchObject(summary)
        expect(
          yield* links.list(topicsLink, { id: memo.id, pageSize: 10 })
        ).toMatchObject(summary)
        expect(yield* search({ query: "Counted", pageSize: 10 })).toMatchObject(
          summary
        )
      }
      for (const page of [
        yield* services.person.list({ pageOffset: 1000, pageSize: 10 }),
        yield* links.list(peopleLink, {
          id: account.id,
          pageOffset: 1000,
          pageSize: 10,
        }),
        yield* links.list(topicsLink, {
          id: memo.id,
          pageOffset: 1000,
          pageSize: 10,
        }),
        yield* search({ query: "Counted", pageOffset: 1000, pageSize: 10 }),
      ]) {
        expect(page.items).toHaveLength(5)
        expect(page.nextPageToken).toBeNull()
        expect(page).toMatchObject({ totalSize: 1000, totalSizeExact: false })
      }
      const ids = new Set<string>()
      let page = yield* services.person.list({ pageSize: 200 })
      while (true) {
        for (const item of page.items) ids.add(item.id)
        if (!page.nextPageToken) break
        page = yield* services.person.list({
          pageSize: 200,
          pageToken: page.nextPageToken,
        })
      }
      expect(ids.size).toBe(1005)
      const selected = yield* services.person.list({
        filter: {
          field: "id",
          operator: "eq",
          value: RecordId("person")("person_count_1"),
        },
      })
      expect(selected).toMatchObject({ totalSize: 1, totalSizeExact: true })
    }),
  30_000
)
