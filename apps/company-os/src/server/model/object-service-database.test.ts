import {
  EmailAddress,
  RecordId,
  modelObjectLinkTraversals,
} from "@company/runtime/model"
import { ROOT_ID } from "@company/runtime/model/system-records"
import { Records } from "@company/runtime/server"
import { UserService } from "@company/runtime/server/access/user-service"
import { Database } from "@company/runtime/server/database/database"
import { makeObjectRepository } from "@company/runtime/server/database/object-repository"
import { CurrentInvocation } from "@company/runtime/server/invocation"
import { systemInvocation } from "@company/runtime/server/invocation-context"
import { Links } from "@company/runtime/server/model/link-service"
import { makeObjectService } from "@company/runtime/server/model/object-service"
import { PageTokens } from "@company/runtime/server/page-tokens"
import { makeLinkRepository } from "@company/runtime/server/postgres"
import { Effect, Layer } from "effect"
import { expect } from "vitest"

import { makeApplicationLayer } from "#/examples/application.server.ts"
import { Model } from "#/examples/model.ts"
import { Storage } from "#/examples/schema.server.ts"
import { ModelImplementation } from "#/examples/services.server.ts"
import { itDatabase } from "#/server/database/it-database.ts"
import { seedSystem } from "#/server/seeds/seed-system.ts"

itDatabase(
  "coordinates Link updates even when ordinary creation is disabled",
  Effect.fn(function* () {
    const database = yield* Database
    yield* seedSystem().pipe(Effect.provide(PageTokens.layerTest))
    yield* Effect.gen(function* () {
      const { services } = yield* ModelImplementation
      const links = yield* Links
      const company = yield* services.company.create({
        name: "Provisioned account",
      })
      const contact = yield* services.contact.create({
        name: "Provisioned contact",
      })
      const companyCount = (yield* services.company.list({})).totalSize
      const invalidCreate = yield* services.company
        .create({
          name: "Must roll back",
          links: {
            contacts: [contact.id, RecordId("contact")("missing-contact")],
          },
        })
        .pipe(Effect.flip)
      expect(invalidCreate).toMatchObject({ _tag: "ObjectNotFound" })
      expect((yield* services.company.list({})).totalSize).toBe(companyCount)
      const linkedCompany = yield* services.company.create({
        name: "Created with links",
        links: { contacts: [contact.id] },
      })
      const companies = modelObjectLinkTraversals(
        Model,
        Model.objects.contact
      ).find(({ traversal }) => traversal.key === "companies")!
      expect(
        (yield* links.list(companies, { id: contact.id })).items
      ).toMatchObject([{ id: linkedCompany.id }])
      // Initializing from the non-writable end must still require the existing owner's update permission.
      const user = yield* (yield* UserService).provision({
        name: "Contact creator",
        email: EmailAddress("creator@example.test"),
      })
      const roleWriter = (yield* Records).writer(Model.objects.role)
      const role = yield* roleWriter.create({
        name: "Create contacts",
        scopeType: "root",
        permissions: ["contact.create", "company.get"],
      })
      yield* services.roleAssignment.create({
        parent: ROOT_ID,
        principal: user.id,
        role: role.id,
      })
      const userInvocation = { actorId: user.id, authorizationActorId: user.id }
      const contactCount = (yield* services.contact.list({})).totalSize
      const createFromContact = () =>
        services.contact
          .create({
            name: "Atomic contact",
            links: { companies: [company.id] },
          })
          .pipe(Effect.provideService(CurrentInvocation, userInvocation))
      expect(yield* createFromContact().pipe(Effect.flip)).toMatchObject({
        _tag: "PermissionDenied",
        permission: "company.update",
      })
      expect((yield* services.contact.list({})).totalSize).toBe(contactCount)
      yield* roleWriter.update({
        id: role.id,
        permissions: ["contact.create", "company.get", "company.update"],
      })
      const linkedContact = yield* createFromContact()
      expect(
        (yield* links.list(companies, { id: linkedContact.id })).items
      ).toMatchObject([{ id: company.id, name: company.name }])
      // Keep the pagination fixture independent of the creation cases above.
      yield* services.contact.delete({ id: linkedContact.id })
      yield* services.company.delete({ id: linkedCompany.id })
      const repository = yield* makeObjectRepository(Model.objects.company)
      // Exercise a runtime contract variant against the same physical Company storage.
      const updateOnly = {
        ...Model.objects.company,
        actions: { ...Model.objects.company.actions },
      }
      Reflect.deleteProperty(updateOnly.actions, "create")
      const service = yield* makeObjectService(updateOnly, repository)
      expect("create" in service).toBe(false)
      yield* service.update({
        id: company.id,
        etag: company.etag,
        links: { contacts: { add: [contact.id] } },
      })
      const companyContacts = modelObjectLinkTraversals(
        Model,
        Model.objects.company
      ).find(({ traversal }) => traversal.key === "contacts")!
      expect(
        (yield* links.list(companyContacts, { id: company.id })).items
      ).toMatchObject([
        { id: contact.id, name: contact.name, objectType: "contact" },
      ])
      const another = yield* services.contact.create({
        name: "A second contact",
      })
      yield* services.contact.create({ name: "A contact outside this company" })
      yield* links.link(companyContacts, { id: company.id, target: another.id })
      const request = {
        id: company.id,
        pageSize: 1,
        sort: [{ field: "name", direction: "asc" }],
      } as const
      const first = yield* links.list(companyContacts, request)
      expect(first.items.map(({ id }) => id)).toEqual([another.id])
      expect(first.totalSize).toBe(2)
      const next = yield* links.list(companyContacts, {
        ...request,
        pageToken: first.nextPageToken!,
      })
      expect(next.items.map(({ id }) => id)).toEqual([contact.id])
      expect(next.nextPageToken).toBeNull()
      const filtered = yield* links.list(companyContacts, {
        ...request,
        filter: { field: "name", operator: "contains", value: "Provisioned" },
      })
      expect(filtered.totalSize).toBe(1)
      expect(filtered.items.map(({ id }) => id)).toEqual([contact.id])
      const otherCompany = yield* services.company.create({
        name: "Other account",
      })
      expect(
        yield* links
          .list(companyContacts, {
            ...request,
            id: otherCompany.id,
            pageToken: first.nextPageToken!,
          })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "InvalidListRequest" })
      expect(
        yield* links
          .list(companyContacts, {
            ...request,
            filter: {
              field: "name",
              operator: "contains",
              value: "Provisioned",
            },
            pageToken: first.nextPageToken!,
          })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "InvalidListRequest" })
      // The exact count and pagination must use only visible linked targets.
      const edgeRepository = makeLinkRepository(
        Storage,
        database,
        yield* PageTokens
      )
      const visible = yield* edgeRepository.list(
        {
          linkId: companyContacts.link.id,
          direction: companyContacts.direction,
          sourceId: company.id,
          pageSize: 1,
        },
        { targets: [{ objectType: "contact", visibleWithin: [contact.id] }] }
      )
      expect(visible).toMatchObject({
        items: [{ id: contact.id }],
        totalSize: 1,
        nextPageToken: null,
      })
    }).pipe(
      Effect.provideService(CurrentInvocation, systemInvocation),
      Effect.provide(
        makeApplicationLayer({
          database: Layer.succeed(Database, database),
          pageTokens: PageTokens.layerTest,
        })
      )
    )
  })
)
