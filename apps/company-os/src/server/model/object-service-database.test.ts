import { modelObjectLinkTraversals } from "@company/runtime"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Model } from "company-os/model"
import { Effect, Layer } from "effect"
import { expect } from "vitest"

import { makeApplicationLayer } from "@/server/application-layer"
import { Database } from "@/server/database/database"
import { itDatabase } from "@/server/database/it-database"
import { makeObjectRepository } from "@/server/database/object-repository"
import { systemInvocation } from "@/server/invocation-context"
import { PageTokens } from "@/server/page-tokens"
import { seedSystem } from "@/server/seeds/seed-system"

import { Links } from "./link-service"
import { ModelImplementation } from "./model-implementation"
import { makeObjectService } from "./object-service"
import { RecordIdentifierResolver } from "./record-identifier-resolver"

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
      ).toEqual([{ id: contact.id, objectType: "contact" }])
    }).pipe(
      Effect.provideService(CurrentInvocation, systemInvocation),
      Effect.provide(
        Layer.mergeAll(
          RecordIdentifierResolver.layer,
          PageTokens.layerTest,
          makeApplicationLayer({
            database: Layer.succeed(Database, database),
            pageTokens: PageTokens.layerTest,
          })
        )
      )
    )
  })
)
