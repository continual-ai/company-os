import { Effect } from "effect"

import { IssueGreeting } from "#/modules/product/model/issue-greeting.ts"
import { Issue } from "#/modules/product/model/issue.ts"
import { Note } from "#/runtime/platform/model/note.ts"
import { Database, defineControllerServer } from "#/runtime/server/index.ts"

export const issueGreeting = defineControllerServer(IssueGreeting, {
  reconcile: Effect.fn("issueGreeting.reconcile")(function* (issueId) {
    const database = yield* Database
    yield* database.transaction(() =>
      Effect.gen(function* () {
        // Lock the target through the read/create transaction, including against deletion.
        const rows =
          yield* database.sql`select id from ${database.table(Issue)} where id = ${issueId} for update`
        if (rows.length === 0) return
        const notes = database.repository(Note)
        const existing = yield* notes.list({
          filter: {
            and: [
              { field: "content", operator: "eq", value: "Hello world" },
              {
                link: "subjects",
                some: { field: "id", operator: "eq", value: issueId },
              },
            ],
          },
          pageSize: 1,
        })
        if (existing.items.length > 0) return
        yield* notes.create({
          content: "Hello world",
          links: { subjects: [issueId] },
        })
      })
    )
  }),
})
