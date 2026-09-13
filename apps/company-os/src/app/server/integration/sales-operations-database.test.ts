import { Effect, Exit } from "effect"
import { expect } from "vitest"

import { applicationOperations } from "#/app/server/application-services.ts"
import { testApplication } from "#/app/server/test-application.ts"
import { linkPreview } from "#/runtime/model/record-links.ts"
import { anonymousInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { CommittedChanges } from "#/runtime/server/storage/committed-changes.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

const application = testApplication()

application.test(
  "converts qualification into an opportunity without duplicating customer identities",
  () =>
    Effect.gen(function* () {
      const services = yield* applicationOperations
      const database = yield* SqlDatabase
      const account = yield* services.account.create({ name: "Northstar" })
      const partner = yield* services.account.create({
        name: "Implementation partner",
      })
      const contact = yield* services.contact.create({
        name: "Maya Chen",
      })
      for (const linkedAccount of [account, partner]) {
        yield* services.affiliation.create({
          links: { contact: contact.id, account: linkedAccount.id },
        })
      }
      const input = {
        name: "Northstar pilot",
        links: { account: account.id, contact: contact.id },
      }
      const lead = yield* services.lead.create(input)
      expect(
        yield* services.lead
          .convert({ id: lead.id })
          .pipe(
            Effect.provideService(CurrentInvocation, anonymousInvocation),
            Effect.flip
          )
      ).toMatchObject({ _tag: "ProjectAccessRequired" })
      const changes = new Set<string>()
      const converted = yield* services.lead
        .convert({ id: lead.id })
        .pipe(Effect.provideService(CommittedChanges, changes))
      expect(changes).toEqual(
        new Set(["lead", "opportunity", "account", "contact"])
      )
      const opportunity = yield* services.opportunity.get({
        id: converted.opportunity,
        expand: true,
      })
      expect(opportunity.links.accounts).toMatchObject({
        items: [{ id: account.id }],
        totalSize: 1,
      })
      expect(opportunity.links.contacts).toMatchObject({
        items: [{ id: contact.id }],
        totalSize: 1,
      })
      expect(opportunity.stage).toBe("qualified")
      changes.clear()
      expect(
        yield* services.lead
          .convert({ id: lead.id })
          .pipe(Effect.provideService(CommittedChanges, changes))
      ).toEqual(converted)
      expect(changes.size).toBe(0)
      expect((yield* services.account.list({})).totalSize).toBe(2)
      expect((yield* services.contact.list({})).totalSize).toBe(1)
      expect(
        linkPreview(
          (yield* services.contact.get({ id: contact.id })).links.affiliations
        ).totalSize
      ).toBe(2)

      const rollback = yield* services.lead.create({
        ...input,
        name: "Rollback",
      })
      yield* database
        .transaction(() =>
          Effect.gen(function* () {
            yield* services.lead.convert({ id: rollback.id })
            return yield* Effect.fail("cancel" as const)
          })
        )
        .pipe(Effect.flip)
      expect(
        (yield* services.lead.get({ id: rollback.id })).links.opportunity
      ).toBeNull()
      expect((yield* services.opportunity.list({})).totalSize).toBe(1)

      const contested = yield* services.lead.create({
        ...input,
        name: "Concurrent conversion",
      })
      const results = yield* Effect.all(
        [
          services.lead.convert({ id: contested.id }).pipe(Effect.exit),
          services.lead.convert({ id: contested.id }).pipe(Effect.exit),
        ],
        { concurrency: 2 }
      )
      const winner = yield* services.lead.convert({ id: contested.id })
      expect(results.some(Exit.isSuccess)).toBe(true)
      for (const result of results)
        if (Exit.isSuccess(result)) expect(result.value).toEqual(winner)
      expect((yield* services.opportunity.list({})).totalSize).toBe(2)
      expect((yield* services.contact.list({})).totalSize).toBe(1)
      const disqualified = yield* services.lead.create({
        ...input,
        status: "disqualified",
      })
      expect(
        yield* services.lead.convert({ id: disqualified.id }).pipe(Effect.flip)
      ).toMatchObject({ status: "FAILED_PRECONDITION" })
    })
)
