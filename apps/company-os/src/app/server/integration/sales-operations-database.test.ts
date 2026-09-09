import { Effect, Exit, Layer } from "effect"
import { expect } from "vitest"

import { Model } from "#/app.model.ts"
import { makeApplicationLayer } from "#/app/server/application-layer.ts"
import { ModelImplementation } from "#/app/server/application-services.ts"
import { itDatabase } from "#/app/server/database/it-database.ts"
import { seedSystem } from "#/app/server/seeds/seed-system.ts"
import { UserService } from "#/runtime/access/server/user-service.ts"
import {
  CurrencyCode,
  Decimal,
  EmailAddress,
  modelObjectLinkTraversals,
} from "#/runtime/model/index.ts"
import { ROOT_ID } from "#/runtime/model/system-records.ts"
import { CommittedChanges } from "#/runtime/server/database/committed-changes.ts"
import { Database } from "#/runtime/server/database/database.ts"
import { Records } from "#/runtime/server/index.ts"
import {
  anonymousInvocation,
  systemInvocation,
} from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { Links } from "#/runtime/server/model/link-service.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"

itDatabase(
  "keeps custom queries scoped, conversions atomic, and primary affiliation a selection",
  Effect.fn(function* () {
    const database = yield* Database
    yield* seedSystem().pipe(Effect.provide(PageTokens.layerTest))
    yield* Effect.gen(function* () {
      // Constructed under system invocation deliberately: bindings must never capture its authority.
      const { services } = yield* ModelImplementation
      const users = yield* UserService
      const links = yield* Links
      const roles = (yield* Records).writer(Model.objects.role)
      const reader = yield* users.provision({
        name: "Scoped reader",
        email: EmailAddress("reader@example.test"),
      })
      const readerInvocation = {
        actorId: reader.id,
        authorizationActorId: reader.id,
      }
      const first = yield* services.company.create({ name: "Readable company" })
      const second = yield* services.company.create({ name: "Other company" })
      for (const [parent, currency, amount] of [
        [first.id, "USD", "0.10"],
        [first.id, "USD", "0.20"],
        [first.id, "EUR", "12.30"],
        [second.id, "USD", "9999.00"],
      ] as const) {
        yield* services.deal.create({
          parent,
          name: "Opportunity",
          amount: { currency: CurrencyCode(currency), amount: Decimal(amount) },
        })
      }
      const queryRole = yield* roles.create({
        name: "Pipeline reports",
        scopeType: "root",
        permissions: ["deal.pipelineSummary"],
      })
      yield* services.roleAssignment.create({
        parent: ROOT_ID,
        principal: reader.id,
        role: queryRole.id,
      })
      const summary = () =>
        services.deal
          .pipelineSummary({})
          .pipe(Effect.provideService(CurrentInvocation, readerInvocation))
      expect(yield* summary()).toEqual({ groups: [] })
      const readRole = yield* roles.create({
        name: "Company deals",
        scopeType: "company",
        permissions: ["deal.get"],
      })
      yield* services.roleAssignment.create({
        parent: first.id,
        principal: reader.id,
        role: readRole.id,
      })
      expect(yield* summary()).toEqual({
        groups: [
          { stage: "discovery", currency: "EUR", count: 1, amount: "12.30" },
          { stage: "discovery", currency: "USD", count: 2, amount: "0.30" },
        ],
      })
      expect(
        yield* services.deal
          .pipelineSummary({})
          .pipe(
            Effect.provideService(CurrentInvocation, anonymousInvocation),
            Effect.flip
          )
      ).toMatchObject({ _tag: "PermissionDenied" })

      const lead = yield* services.lead.create({
        name: "Ada",
        companyName: "Analytical Engines",
      })
      const changes = new Set<string>()
      const converted = yield* services.lead
        .convert({ id: lead.id })
        .pipe(Effect.provideService(CommittedChanges, changes))
      expect(changes).toEqual(new Set(["company", "contact", "lead"]))
      expect((yield* services.lead.get({ id: lead.id })).company).toBe(
        converted.company
      )
      changes.clear()
      expect(
        yield* services.lead
          .convert({ id: lead.id })
          .pipe(Effect.provideService(CommittedChanges, changes))
      ).toEqual(converted)
      expect(changes.size).toBe(0)
      expect(
        (yield* services.contact.get({ id: converted.contact })).name
      ).toBe("Ada")

      const linkedLead = yield* services.lead.create({
        name: "Existing company contact",
        company: first.id,
      })
      const companyCount = (yield* services.company.list({})).totalSize
      const linkedConversion = yield* services.lead.convert({
        id: linkedLead.id,
      })
      expect(linkedConversion.company).toBe(first.id)
      expect((yield* services.company.list({})).totalSize).toBe(companyCount)
      expect(yield* services.lead.convert({ id: linkedLead.id })).toEqual(
        linkedConversion
      )
      const affiliation = modelObjectLinkTraversals(
        Model,
        Model.objects.contact
      ).find(({ traversal }) => traversal.key === "primaryCompany")!
      expect(
        (yield* links.list(affiliation, { id: linkedConversion.contact })).items
      ).toMatchObject([
        { id: first.id, objectType: "company", name: first.name },
      ])

      const conversionRole = yield* roles.create({
        name: "Lead conversion",
        scopeType: "root",
        permissions: ["lead.get", "lead.convert", "contact.create"],
      })
      yield* services.roleAssignment.create({
        parent: ROOT_ID,
        principal: reader.id,
        role: conversionRole.id,
      })
      const restrictedLead = yield* services.lead.create({
        name: "Restricted company contact",
        company: second.id,
      })
      expect(
        yield* services.lead
          .convert({ id: restrictedLead.id })
          .pipe(
            Effect.provideService(CurrentInvocation, readerInvocation),
            Effect.flip
          )
      ).toMatchObject({
        _tag: "AuthorizationTargetNotFound",
        objectType: "company",
      })
      expect(
        (yield* services.lead.get({ id: restrictedLead.id })).convertedAt
      ).toBeNull()
      expect(
        (yield* services.contact.list({
          filter: {
            field: "name",
            operator: "eq",
            value: "Restricted company contact",
          },
        })).totalSize
      ).toBe(0)

      const unassignedLead = yield* services.lead.create({
        name: "Unassigned contact",
      })
      expect(
        yield* services.lead
          .convert({ id: unassignedLead.id })
          .pipe(Effect.flip)
      ).toMatchObject({
        reason: "FAILED_PRECONDITION",
        details: { violations: [{ reason: "LEAD_COMPANY_REQUIRED" }] },
      })
      expect(
        (yield* services.contact.list({
          filter: {
            field: "name",
            operator: "eq",
            value: "Unassigned contact",
          },
        })).totalSize
      ).toBe(0)

      const rolledBackLead = yield* services.lead.create({
        name: "Rollback contact",
        companyName: "Rollback company",
      })
      changes.clear()
      yield* database
        .transaction(() =>
          Effect.gen(function* () {
            yield* services.lead.convert({ id: rolledBackLead.id })
            return yield* Effect.fail("cancel conversion" as const)
          })
        )
        .pipe(Effect.provideService(CommittedChanges, changes), Effect.flip)
      expect(changes.size).toBe(0)
      expect(yield* services.lead.get({ id: rolledBackLead.id })).toMatchObject(
        {
          convertedCompany: null,
          convertedContact: null,
          convertedAt: null,
        }
      )
      expect(
        (yield* services.company.list({
          filter: { field: "name", operator: "eq", value: "Rollback company" },
        })).totalSize
      ).toBe(0)
      expect(
        (yield* services.contact.list({
          filter: { field: "name", operator: "eq", value: "Rollback contact" },
        })).totalSize
      ).toBe(0)

      const contested = yield* services.lead.create({
        name: "Concurrent contact",
        companyName: "Concurrent company",
      })
      const conversions = yield* Effect.all(
        [
          services.lead.convert({ id: contested.id }).pipe(Effect.exit),
          services.lead.convert({ id: contested.id }).pipe(Effect.exit),
        ],
        { concurrency: 2 }
      )
      const winner = yield* services.lead.convert({ id: contested.id })
      expect(conversions.some(Exit.isSuccess)).toBe(true)
      for (const result of conversions) {
        if (Exit.isSuccess(result)) expect(result.value).toEqual(winner)
      }
      expect(
        (yield* services.company.list({
          filter: {
            field: "name",
            operator: "eq",
            value: "Concurrent company",
          },
        })).totalSize
      ).toBe(1)
      expect(
        (yield* services.contact.list({
          filter: {
            field: "name",
            operator: "eq",
            value: "Concurrent contact",
          },
        })).totalSize
      ).toBe(1)

      const primary = modelObjectLinkTraversals(
        Model,
        Model.objects.contact
      ).find(({ traversal }) => traversal.key === "primaryCompany")!
      const memberships = modelObjectLinkTraversals(
        Model,
        Model.objects.contact
      ).find(({ traversal }) => traversal.key === "companies")!
      const contacts = modelObjectLinkTraversals(
        Model,
        Model.objects.company
      ).find(({ traversal }) => traversal.key === "contacts")!
      yield* links.link(primary, { id: converted.contact, target: first.id })
      expect(
        (yield* links.list(memberships, { id: converted.contact })).totalSize
      ).toBe(2)
      expect(
        (yield* links.list(primary, { id: converted.contact })).items
      ).toMatchObject([
        { id: first.id, objectType: "company", name: first.name },
      ])
      yield* links.unlink(contacts, { id: first.id, target: converted.contact })
      expect(
        (yield* links.list(primary, { id: converted.contact })).items
      ).toEqual([])
      expect(
        (yield* links.list(memberships, { id: converted.contact })).totalSize
      ).toBe(1)

      // Adding a commercial party cannot change the deal's inherited authorization.
      const privateDeal = yield* services.deal.create({
        parent: second.id,
        name: "Private agreement",
      })
      const dealCompanies = modelObjectLinkTraversals(
        Model,
        Model.objects.deal
      ).find(({ traversal }) => traversal.key === "companies")!
      yield* links.link(dealCompanies, { id: privateDeal.id, target: first.id })
      expect(privateDeal.parent).toBe(second.id)
      expect(
        (yield* summary()).groups.reduce(
          (total, group) => total + group.count,
          0
        )
      ).toBe(3)
    }).pipe(
      Effect.provide(
        makeApplicationLayer({
          database: Layer.succeed(Database, database),
          pageTokens: PageTokens.layerTest,
        })
      ),
      Effect.provideService(CurrentInvocation, systemInvocation)
    )
  })
)
