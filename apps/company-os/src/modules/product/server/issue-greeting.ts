import { Effect } from "effect"

import { Note } from "#/modules/notes/model/index.ts"
import { IssueGreeting } from "#/modules/product/model/issue-greeting.ts"
import { Issue } from "#/modules/product/model/issue.ts"
import { type PageToken } from "#/runtime/model/index.ts"
import { Database, defineControllerServer } from "#/runtime/server/index.ts"

export const issueGreeting = defineControllerServer(IssueGreeting, {
  onEvent: Effect.fn("issueGreeting.onEvent")(function* (event, { queue }) {
    if (event.type !== "note.updated") return
    const database = yield* Database
    for (const subject of event.subjects) {
      if (subject.objectType !== Note.id) continue
      let pageToken: PageToken | undefined
      do {
        const page = yield* database.repository(Issue).list({
          filter: {
            link: "notes",
            some: { field: "id", operator: "eq", value: subject.id },
          },
          pageSize: 100,
          ...(pageToken ? { pageToken } : {}),
        })
        for (const issue of page.items) yield* queue.add(issue.id)
        pageToken = page.nextPageToken ?? undefined
      } while (pageToken)
    }
  }),
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
