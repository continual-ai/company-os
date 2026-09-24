import { createHash } from "node:crypto"

import { Clock, DateTime, Effect, Schema } from "effect"

import { Account } from "#/modules/crm/model/account.ts"
import { Activity } from "#/modules/crm/model/activity.ts"
import { Affiliation } from "#/modules/crm/model/affiliation.ts"
import {
  ContactBrief,
  type RequestContactBrief,
  type BeginContactBrief,
  type CompleteContactBrief,
  type FailContactBrief,
} from "#/modules/crm/model/contact-brief.ts"
import { Contact } from "#/modules/crm/model/contact.ts"
import {
  type ActionInput,
  type ObjectType,
  type ObjectRecord,
  type RecordId,
  type PageToken,
  Timestamp,
} from "#/runtime/model/index.ts"
import { linkedId } from "#/runtime/model/record-links.ts"
import { Note } from "#/runtime/platform/model/note.ts"
import { Database } from "#/runtime/server/index.ts"

const precondition = (message: string) =>
  Effect.fail({
    status: "FAILED_PRECONDITION" as const,
    reason: "FAILED_PRECONDITION" as const,
    message,
  })

// Every page is read; link previews alone can silently omit source records.
const related = <O extends ObjectType>(object: O, link: string, id: string) =>
  Effect.gen(function* () {
    const repository = (yield* Database).repository(object)
    const records: Array<ObjectRecord<O>> = []
    let pageToken: PageToken | undefined
    do {
      const page = yield* repository.list({
        filter: { link, some: { field: "id", operator: "eq", value: id } },
        pageSize: 100,
        ...(pageToken ? { pageToken } : {}),
      })
      records.push(...page.items)
      pageToken = page.nextPageToken ?? undefined
    } while (pageToken)
    return records.sort((a, b) => a.id.localeCompare(b.id))
  })

const briefContext = (id: RecordId<"contact">) =>
  Effect.gen(function* () {
    const database = yield* Database
    const contact = yield* database.repository(Contact).get({ id })
    const affiliations = yield* related(Affiliation, "contact", id)
    const activities = yield* related(Activity, "contacts", id)
    const accountIds = [
      ...new Set(
        affiliations.map((record) => linkedId(record, "account", Account)!)
      ),
    ].sort()
    const accounts = yield* Effect.forEach(accountIds, (accountId) =>
      database.repository(Account).get({ id: accountId })
    )
    const sources = [contact, ...affiliations, ...activities, ...accounts]
    const notes = yield* Effect.forEach(sources, (record) =>
      related(Note, "subjects", record.id)
    )
    // Do not hash presentation/link previews (a new brief itself adds a link).
    const revision = createHash("sha256")
      .update(
        JSON.stringify(
          [...sources, ...notes.flat()]
            .map(({ id: recordId, etag }) => ({ id: recordId, etag }))
            .sort((a, b) => a.id.localeCompare(b.id))
        )
      )
      .digest("hex")
    return {
      revision,
      context: yield* Schema.decodeUnknownEffect(Schema.Json)(
        JSON.parse(
          JSON.stringify({
            contact,
            affiliations,
            activities,
            accounts,
            notes: notes.flat(),
          })
        )
      ),
    }
  })

export const requestBrief = Effect.fn("contact.requestBrief")(function* (
  input: ActionInput<typeof RequestContactBrief>
) {
  const database = yield* Database
  // Serialize deduplication by contact, including concurrent first requests.
  const table = database.table(Contact)
  yield* database.sql`select id from ${table} where id = ${input.id} for update`
  yield* database.repository(Contact).get({ id: input.id })
  const repository = database.repository(ContactBrief)
  const existing = yield* repository.list({
    filter: {
      and: [
        {
          link: "contact",
          some: { field: "id", operator: "eq", value: input.id },
        },
        { field: "requestKey", operator: "eq", value: input.requestKey },
      ],
    },
    pageSize: 1,
  })
  if (existing.items[0]) return { briefId: existing.items[0].id }
  const brief = yield* repository.create({
    requestKey: input.requestKey,
    links: { contact: input.id },
  })
  return { briefId: brief.id }
})

export const beginBrief = Effect.fn("contactBrief.begin")(function* (
  input: ActionInput<typeof BeginContactBrief>
) {
  const repository = (yield* Database).repository(ContactBrief)
  const brief = yield* repository.get({ id: input.id })
  const now = yield* Clock.currentTimeMillis
  if (
    brief.status !== "pending" &&
    !(brief.status === "running" && Date.parse(brief.leaseExpiresAt!) <= now)
  )
    return yield* precondition(
      "This brief is not pending and has no expired lease."
    )
  const { revision, context } = yield* briefContext(
    linkedId(brief, "contact", Contact)!
  )
  const leaseToken = crypto.randomUUID()
  yield* repository.update({
    id: brief.id,
    etag: brief.etag,
    status: "running",
    threadId: input.threadId,
    leaseToken,
    leaseExpiresAt: Timestamp(
      DateTime.formatIso(DateTime.makeUnsafe(now + 15 * 60 * 1000))
    ),
    inputRevision: revision,
    error: null,
  })
  return { leaseToken, inputRevision: revision, context }
})

export const completeBrief = Effect.fn("contactBrief.complete")(function* (
  input: ActionInput<typeof CompleteContactBrief>
) {
  const database = yield* Database
  const repository = database.repository(ContactBrief)
  const brief = yield* repository.get({ id: input.id })
  if (
    brief.leaseToken !== input.leaseToken ||
    brief.inputRevision !== input.inputRevision
  )
    return yield* precondition(
      "The brief lease or input revision no longer matches."
    )
  if (brief.status === "completed" && brief.result === input.summary)
    return { status: "completed" as const }
  if (brief.status === "stale") return { status: "stale" as const }
  if (
    brief.status !== "running" ||
    Date.parse(brief.leaseExpiresAt!) <= (yield* Clock.currentTimeMillis)
  )
    return yield* precondition("The brief lease is no longer active.")
  const id = linkedId(brief, "contact", Contact)!
  const { revision } = yield* briefContext(id)
  if (revision !== input.inputRevision) {
    yield* repository.update({
      id: brief.id,
      etag: brief.etag,
      status: "stale",
      leaseExpiresAt: null,
    })
    return { status: "stale" as const }
  }
  const contact = yield* database.repository(Contact).get({ id })
  yield* database
    .repository(Contact)
    .update({ id, etag: contact.etag, summary: input.summary })
  yield* repository.update({
    id: brief.id,
    etag: brief.etag,
    status: "completed",
    result: input.summary,
    leaseExpiresAt: null,
  })
  return { status: "completed" as const }
})

export const failBrief = Effect.fn("contactBrief.fail")(function* (
  input: ActionInput<typeof FailContactBrief>
) {
  const repository = (yield* Database).repository(ContactBrief)
  const brief = yield* repository.get({ id: input.id })
  if (brief.leaseToken !== input.leaseToken)
    return yield* precondition("The brief lease no longer matches.")
  if (brief.status === "failed") return {}
  if (
    brief.status !== "running" ||
    Date.parse(brief.leaseExpiresAt!) <= (yield* Clock.currentTimeMillis)
  )
    return yield* precondition("The brief lease is no longer active.")
  yield* repository.update({
    id: brief.id,
    etag: brief.etag,
    status: "failed",
    error: input.error,
    leaseExpiresAt: null,
  })
  return {}
})
