import { DateTime, Effect } from "effect"

import {
  Timestamp,
  type ApiError,
  type FailedPreconditionError,
  type ObjectGetInput,
} from "#/runtime/model/index.ts"
import { linkedId } from "#/runtime/model/record-links.ts"
import { Database } from "#/runtime/server/database.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { defineModuleServer } from "#/runtime/server/module-server.ts"
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
  const accounts = database.repository(Account)
  const people = database.repository(Person)
  const prospects = database.repository(Prospect)
  const prospect = yield* prospects.get(input)
  const convertedAccount = linkedId(prospect, "convertedAccount", Account)
  const convertedPerson = linkedId(prospect, "convertedPerson", Person)
  if (convertedAccount !== null && convertedPerson !== null)
    return {
      account: convertedAccount,
      person: convertedPerson,
    }
  if (prospect.accountName === null) return yield* Effect.fail(accountRequired)
  const account = yield* accounts.create({ name: prospect.accountName })
  const person = yield* people.create({
    email: prospect.email,
    name: prospect.name,
    links: { accounts: [account.id], billingAccount: account.id },
  })
  yield* prospects.update({
    convertedAt: Timestamp(DateTime.formatIso(yield* DateTime.now)),
    etag: prospect.etag,
    id: prospect.id,
    links: {
      convertedAccount: account.id,
      convertedPerson: person.id,
    },
  })
  yield* events.append(ProspectConverted, {
    subject: prospect.id,
    data: { account: account.id, person: person.id },
  })
  return { account: account.id, person: person.id }
})

export const FixtureServer = defineModuleServer(FixtureModule, {
  prospect: { convert: convertProspect },
})
