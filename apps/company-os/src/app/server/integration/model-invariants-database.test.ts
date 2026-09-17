import { Effect, Layer } from "effect"
import { expect } from "vitest"

import { Model } from "#/app.model.ts"
import { testApplication } from "#/app/server/test-application.ts"
import { HttpTransport } from "#/app/server/transport/http-transport.ts"
import { createEffectClient } from "#/runtime/client/create-client.ts"
import { CalendarDate, standardErrorViolations } from "#/runtime/model/index.ts"
import { IdentityProvider } from "#/runtime/server/auth/identity-provider.ts"
import { Database } from "#/runtime/server/database.ts"

const application = testApplication({
  identityProvider: Layer.succeed(IdentityProvider, {
    identify: () =>
      Effect.succeed({
        issuer: "test",
        subject: "model-owner",
        email: "model@example.test",
        kind: "user" as const,
        name: "Model owner",
      }),
  }),
})

application.test(
  "derives relationship labels consistently and refreshes search after related renames",
  () =>
    Effect.gen(function* () {
      const api = yield* HttpTransport
      const client = createEffectClient(Model, {
        baseUrl: "http://company.test",
        fetch: (input, init) =>
          Effect.runPromise(api.handle(new Request(input, init))),
      })
      const account = yield* client.account.create({ name: "Northstar" })
      const contact = yield* client.contact.create({ name: "Maya Chen" })
      const affiliation = yield* client.affiliation.create({
        jobTitle: "Founder",
        links: { contact: contact.id, account: account.id },
      })
      expect(affiliation.label).toBe("Maya Chen · Northstar")
      expect(
        (yield* client.affiliation.list({
          filter: { field: "label", operator: "contains", value: "Maya" },
        })).items
      ).toMatchObject([{ id: affiliation.id, label: affiliation.label }])
      expect(
        (yield* client.contact.get({ id: contact.id, expand: true })).links
          .affiliations
      ).toMatchObject({
        items: [{ id: affiliation.id, label: affiliation.label }],
        totalSize: 1,
      })
      yield* client.account.update({ id: account.id, name: "Renamed Robotics" })
      const renamed = "Maya Chen · Renamed Robotics"
      expect(
        (yield* client.affiliation.get({ id: affiliation.id })).label
      ).toBe(renamed)
      expect(
        (yield* client.records.search({
          query: "Renamed",
          objectTypes: ["affiliation"],
        })).items
      ).toMatchObject([{ id: affiliation.id, title: renamed }])
      expect(
        (yield* client.records.search({
          query: "Northstar",
          objectTypes: ["affiliation"],
        })).items
      ).toEqual([])
      const campaign = yield* client.campaign.create({ name: "Roundtable" })
      const member = yield* client.campaignMember.create({
        links: { campaign: campaign.id, contact: contact.id },
      })
      expect(member.label).toBe("Maya Chen · Roundtable")
      expect(member).not.toHaveProperty("name")
      const hydrated = yield* client.records.batchGet({
        ids: [affiliation.id, member.id],
      })
      expect(hydrated.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: affiliation.id,
            objectType: "affiliation",
            label: renamed,
          }),
          expect.objectContaining({
            id: member.id,
            objectType: "campaignMember",
            label: member.label,
          }),
        ])
      )
    })
)

application.test(
  "enforces date ordering on create, partial updates, and direct SQL without partial writes",
  () =>
    Effect.gen(function* () {
      const api = yield* HttpTransport
      const client = createEffectClient(Model, {
        baseUrl: "http://company.test",
        fetch: (input, init) =>
          Effect.runPromise(api.handle(new Request(input, init))),
      })
      const invalid = yield* client.campaign
        .create({
          name: "Invalid",
          startDate: CalendarDate("2026-05-10"),
          endDate: CalendarDate("2026-05-01"),
        })
        .pipe(Effect.flip)
      expect(invalid).toMatchObject({
        status: "INVALID_ARGUMENT",
        reason: "VALIDATION_FAILED",
        details: {
          violations: [
            { path: ["startDate"], reason: "CHECK_FAILED" },
            { path: ["endDate"], reason: "CHECK_FAILED" },
          ],
        },
      })
      expect(standardErrorViolations(invalid)).toHaveLength(2)
      expect((yield* client.campaign.list({})).totalSize).toBe(0)
      const campaign = yield* client.campaign.create({
        name: "Roundtable",
        startDate: CalendarDate("2026-05-10"),
        endDate: CalendarDate("2026-05-20"),
      })
      expect(
        yield* client.campaign
          .update({
            id: campaign.id,
            name: "Must roll back",
            endDate: CalendarDate("2026-05-01"),
          })
          .pipe(Effect.flip)
      ).toMatchObject({ reason: "VALIDATION_FAILED" })
      expect(yield* client.campaign.get({ id: campaign.id })).toMatchObject({
        name: campaign.name,
        etag: campaign.etag,
        endDate: campaign.endDate,
      })
      const database = yield* Database
      const table = database.table(Model.objects.campaign)
      expect(
        yield* database
          .transaction(
            () =>
              database.sql`update ${table} set ${database.sql(table.columns.endDate.name)} = '2026-05-01' where ${table.columns.id} = ${campaign.id}`
          )
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "ObjectCheckFailed", rule: "dates" })
      const moved = yield* client.campaign.update({
        id: campaign.id,
        startDate: CalendarDate("2026-06-01"),
        endDate: CalendarDate("2026-06-02"),
      })
      expect(moved.startDate).toBe("2026-06-01")
      expect(
        (yield* client.campaign.update({ id: campaign.id, endDate: null }))
          .endDate
      ).toBeNull()
    })
)
