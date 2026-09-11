import { DateTime, Effect } from "effect"

import {
  Timestamp,
  type ApiError,
  type FailedPreconditionError,
  type ObjectGetInput,
} from "#/runtime/model/index.ts"
import { linkedId } from "#/runtime/model/record-links.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { Links } from "#/runtime/server/model/link-service.ts"
import { defineModuleServer } from "#/runtime/server/model/module-server.ts"
import { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import { RecordIdentifierResolver } from "#/runtime/server/model/record-identifier-resolver.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import {
  Account,
  FixtureModule,
  Person,
  Prospect,
  ProspectConverted,
} from "#/runtime/testing/fixture-model.ts"

const accountRequired: ApiError<typeof FailedPreconditionError> = {
  status: "FAILED_PRECONDITION",
  reason: "FAILED_PRECONDITION",
  message: "The prospect cannot be converted.",
  details: {
    violations: [
      {
        message: "Enter an account name before converting this prospect.",
        path: ["accountName"],
        reason: "PROSPECT_ACCOUNT_REQUIRED",
      },
    ],
  },
}

/** A custom action exercising writers, links, and a declared event in one transaction. */
const convertProspect = Effect.fn("fixture.convertProspect")(function* (
  input: ObjectGetInput<typeof Prospect>
) {
  const events = yield* EventJournal
  const database = yield* Database
  const records = yield* ObjectRepositories
  const accounts = records.writer(Account)
  const people = records.writer(Person)
  const prospects = records.writer(Prospect)
  const personLinks = (yield* Links).writer(Person)
  const id = yield* (yield* RecordIdentifierResolver).resolve(
    "prospect",
    input.id
  )
  return yield* database.transaction(() =>
    Effect.gen(function* () {
      yield* requireProjectAccess
      const prospect = yield* records.get(Prospect).get(id)
      const convertedAccount = linkedId(prospect, "convertedAccount", Account)
      const convertedPerson = linkedId(prospect, "convertedPerson", Person)
      if (convertedAccount !== null && convertedPerson !== null)
        return {
          account: convertedAccount,
          person: convertedPerson,
        }
      if (prospect.accountName === null)
        return yield* Effect.fail(accountRequired)
      const account = yield* accounts.create({ name: prospect.accountName })
      const person = yield* people.create({
        email: prospect.email,
        name: prospect.name,
      })
      yield* personLinks.initialize(person.id, {
        accounts: [account.id],
        primaryAccount: [account.id],
      })
      yield* prospects.update({
        convertedAt: Timestamp(DateTime.formatIso(yield* DateTime.now)),
        etag: prospect.etag,
        id,
        links: {
          convertedAccount: { replace: [account.id] },
          convertedPerson: { replace: [person.id] },
        },
      })
      yield* events.append(ProspectConverted, {
        subject: prospect.id,
        data: { account: account.id, person: person.id },
      })
      return { account: account.id, person: person.id }
    })
  )
})

export const FixtureServer = defineModuleServer(FixtureModule, {
  prospect: { convert: convertProspect },
})
