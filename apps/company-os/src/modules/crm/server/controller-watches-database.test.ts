import { Effect } from "effect"
import { expect } from "vitest"

import { Account } from "#/modules/crm/model/account.ts"
import { Affiliation } from "#/modules/crm/model/affiliation.ts"
import { Contact } from "#/modules/crm/model/contact.ts"
import { CrmModule } from "#/modules/crm/model/index.ts"
import { CrmServer } from "#/modules/crm/server/index.ts"
import type { EventPage } from "#/runtime/contract/events.ts"
import {
  defineController,
  defineModel,
  defineModule,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { Note } from "#/runtime/platform/model/note.ts"
import { Database, EventJournal } from "#/runtime/server/index.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const AccountNotes = defineController({
  id: "account-notes-test",
  record: Contact,
  watch: ["affiliations.account.notes"],
})
const AllContacts = defineController({
  id: "all-contacts-test",
  object: Contact,
  watch: ["affiliations.account.notes"],
})
const Model = defineModel({
  name: "Controller relationship watches",
  modules: [
    PlatformModule,
    CrmModule,
    defineModule({
      id: "watchTests",
      name: "Watch tests",
      controllers: [AccountNotes, AllContacts],
    }),
  ],
})
const fixture = testFoundation(Model, { servers: [CrmServer] })

const routedKeys = (events: EventPage["items"], controller = AccountNotes.id) =>
  [
    ...new Set(
      events.flatMap((event) => event.controllerKeys[controller] ?? [])
    ),
  ].sort()

const setup = Effect.gen(function* () {
  const database = yield* Database
  const journal = yield* EventJournal
  const contacts = database.repository(Contact)
  const accounts = database.repository(Account)
  const affiliations = database.repository(Affiliation)
  const notes = database.repository(Note)
  const first = yield* contacts.create({ name: "First" })
  const second = yield* contacts.create({ name: "Second" })
  const unrelated = yield* contacts.create({ name: "Unrelated" })
  const account = yield* accounts.create({ name: "Shared account" })
  const affiliation = yield* affiliations.create({
    links: { contact: first.id, account: account.id },
  })
  yield* affiliations.create({
    links: { contact: second.id, account: account.id },
  })
  const note = yield* notes.create({
    content: "Context",
    links: { subjects: [account.id] },
  })
  const changes = <A, E, R>(operation: Effect.Effect<A, E, R>) =>
    Effect.gen(function* () {
      const { nextCursor: cursor } = yield* journal.list({ cursor: "now" })
      yield* operation
      const page = yield* journal.list({ cursor, pageSize: 500 })
      expect(page.hasMore).toBe(false)
      return page.items
    })

  return {
    database,
    contacts,
    accounts,
    affiliations,
    notes,
    first,
    second,
    unrelated,
    account,
    affiliation,
    note,
    changes,
    keys: routedKeys,
  }
})

fixture.test(
  "routes leaf and intermediate changes through named paths, without waking unrelated records",
  () =>
    Effect.gen(function* () {
      const {
        accounts,
        notes,
        first,
        second,
        unrelated,
        account,
        note,
        changes,
        keys,
      } = yield* setup
      const expected = [first.id, second.id].sort()
      const leaf = yield* changes(
        notes.update({ id: note.id, content: "Changed context" })
      )
      expect(keys(leaf)).toEqual(expected)
      expect(keys(leaf, AllContacts.id)).toEqual(["object"])
      expect(keys(leaf, "contact-summary")).toEqual(expected)
      expect(
        keys(
          yield* changes(accounts.update({ id: account.id, name: "Renamed" }))
        )
      ).toEqual(expected)
      expect(
        keys(
          yield* changes(
            notes.create({
              content: "Unrelated",
              links: { subjects: [unrelated.id] },
            })
          )
        )
      ).toEqual([])
      expect(
        keys(yield* changes(notes.create({ content: "Detached" })))
      ).toEqual([])
    })
)

fixture.test("captures old and new targets when replacing a relationship", () =>
  Effect.gen(function* () {
    const {
      affiliations,
      first,
      second,
      unrelated,
      affiliation,
      note,
      notes,
      changes,
      keys,
    } = yield* setup
    const events = yield* changes(
      affiliations.update({
        id: affiliation.id,
        links: { contact: unrelated.id },
      })
    )
    expect(keys(events)).toEqual([first.id, unrelated.id].sort())
    // Replay still contains the former contact after the live relationship has moved.
    expect(keys(events, "contact-summary")).toEqual(
      [first.id, unrelated.id].sort()
    )
    expect(
      keys(yield* changes(notes.update({ id: note.id, content: "After move" })))
    ).toEqual([second.id, unrelated.id].sort())
  })
)

fixture.test(
  "keeps removed-path keys across unlink and multi-step deletion in one transaction",
  () =>
    Effect.gen(function* () {
      const {
        database,
        notes,
        affiliations,
        first,
        second,
        note,
        affiliation,
        changes,
        keys,
      } = yield* setup
      const events = yield* changes(
        database.transaction(() =>
          Effect.gen(function* () {
            // Remove an earlier edge, then delete the leaf before the journal can be consumed.
            yield* affiliations.delete({ id: affiliation.id })
            yield* notes.delete({ id: note.id })
          })
        )
      )
      expect(keys(events)).toEqual([first.id, second.id].sort())
      expect(keys(events, "contact-summary")).toEqual(
        [first.id, second.id].sort()
      )
    })
)

fixture.test(
  "routes leaf unlinks and direct note deletions, and rolls invalidations back with writes",
  () =>
    Effect.gen(function* () {
      const { database, notes, first, second, note, changes, keys } =
        yield* setup
      expect(
        keys(
          yield* changes(notes.update({ id: note.id, links: { subjects: [] } }))
        )
      ).toEqual([first.id, second.id].sort())
      const direct = yield* notes.create({
        content: "Direct",
        links: { subjects: [first.id] },
      })
      const deleted = yield* changes(notes.delete({ id: direct.id }))
      expect(keys(deleted, "contact-summary")).toEqual([first.id])
      expect(keys(deleted)).toEqual([])
      const rolledBack = yield* changes(
        database
          .transaction(() =>
            notes
              .create({ content: "Rollback", links: { subjects: [first.id] } })
              .pipe(Effect.andThen(Effect.fail("rollback")))
          )
          .pipe(Effect.exit)
      )
      expect(rolledBack).toEqual([])
    })
)

fixture.test(
  "filters summary-only writes without suppressing mixed or relationship changes",
  () =>
    Effect.gen(function* () {
      const { contacts, first, changes, keys } = yield* setup
      expect(
        keys(
          yield* changes(
            contacts.update({ id: first.id, summary: "Human edit" })
          ),
          "contact-summary"
        )
      ).toEqual([])
      expect(
        keys(
          yield* changes(
            contacts.update({
              id: first.id,
              summary: "Agent edit",
              name: "Updated",
            })
          ),
          "contact-summary"
        )
      ).toEqual([first.id])
      expect(
        keys(
          yield* changes(
            contacts.update({
              id: first.id,
              summary: "Summary with new context",
              metadata: { source: "meeting" },
            })
          ),
          "contact-summary"
        )
      ).toEqual([first.id])
      const detached = yield* contacts.create({ name: "Removed contact" })
      const removed = yield* changes(contacts.delete({ id: detached.id }))
      expect(keys(removed, "contact-summary")).toEqual([detached.id])
    })
)

fixture.test("routes every dependent contact beyond a list page", () =>
  Effect.gen(function* () {
    const {
      contacts,
      affiliations,
      account,
      notes,
      note,
      changes,
      keys,
      first,
      second,
    } = yield* setup
    const ids = [first.id, second.id]
    for (let index = 0; index < 101; index++) {
      const contact = yield* contacts.create({ name: `Dependent ${index}` })
      ids.push(contact.id)
      yield* affiliations.create({
        links: { contact: contact.id, account: account.id },
      })
    }
    const events = yield* changes(
      notes.update({ id: note.id, content: "Everyone needs refreshing" })
    )
    expect(keys(events)).toEqual(ids.sort())
    expect(keys(events, AllContacts.id)).toEqual(["object"])
  })
)
