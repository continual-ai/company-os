import { readFile } from "node:fs/promises"

import { modelObjectLinkTraversals } from "@company/runtime"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Model } from "company-os/model"
import { sql } from "drizzle-orm"
import { Effect, Layer } from "effect"
import { expect } from "vitest"

import { makeApplicationLayer } from "@/server/application-layer"
import { systemInvocation } from "@/server/invocation-context"
import { Links } from "@/server/model/link-service"
import { ModelImplementation } from "@/server/model/model-implementation"
import { PageTokens } from "@/server/page-tokens"
import { seedSystem } from "@/server/seeds/seed-system"

import { Database } from "./database"
import { itDatabase } from "./it-database"
import {
  contactCompanies,
  contactPrimaryCompanies,
  dealCompanies,
  objects,
  roleAssignments,
} from "./schema"

itDatabase(
  "backfills affiliations without changing existing ownership or grants",
  Effect.fn(function* () {
    const database = yield* Database
    yield* seedSystem().pipe(Effect.provide(PageTokens.layerTest))
    const migration = yield* Effect.promise(() =>
      readFile(
        new URL(
          "./migrations/20260905150235_sales-relationships/migration.sql",
          import.meta.url
        ),
        "utf8"
      )
    )
    yield* Effect.gen(function* () {
      const { services } = yield* ModelImplementation
      const company = yield* services.company.create({
        name: "Existing company",
      })
      const contact = yield* services.contact.create({
        name: "Existing contact",
      })
      const links = yield* Links
      const primary = modelObjectLinkTraversals(
        Model,
        Model.objects.contact
      ).find(({ traversal }) => traversal.key === "primaryCompany")!
      yield* links.link(primary, { id: contact.id, target: company.id })
      const deal = yield* services.deal.create({
        parent: company.id,
        name: "Existing deal",
      })
      const beforeObjects = yield* database
        .select()
        .from(objects)
        .orderBy(objects.id)
      const beforeGrants = yield* database
        .select()
        .from(roleAssignments)
        .orderBy(roleAssignments.id)

      // Reconstruct the previous relationship schema only in this isolated test database.
      // Primary selections, ownership rows, and grants survive so the actual migration must preserve them.
      yield* database.execute(
        sql`ALTER TABLE contact_primary_company DROP CONSTRAINT contact_primary_company_membership_fk`
      )
      yield* database.execute(sql`DROP TABLE contact_companies`)
      yield* database.execute(sql`DROP TABLE deal_companies`)
      yield* database.execute(
        sql`ALTER TABLE deals DROP CONSTRAINT deals_parent_authorization_scope_fk`
      )
      yield* database.execute(
        sql`ALTER TABLE deals ADD CONSTRAINT deals_parent_company_fk FOREIGN KEY (parent_id) REFERENCES companies(id) ON DELETE RESTRICT`
      )
      yield* database.transaction(() =>
        Effect.gen(function* () {
          for (const statement of migration.split("--> statement-breakpoint")) {
            // SAFETY: replay only the reviewed, committed migration.sql above in an isolated test database.
            // oxlint-disable-next-line company-os/no-unsafe-sql
            yield* database.execute(sql.raw(statement))
          }
        })
      )

      expect(yield* database.select().from(contactCompanies)).toEqual([
        { forwardId: contact.id, reverseId: company.id },
      ])
      expect(yield* database.select().from(contactPrimaryCompanies)).toEqual([
        { forwardId: contact.id, reverseId: company.id },
      ])
      expect(yield* database.select().from(dealCompanies)).toEqual([
        { forwardId: deal.id, reverseId: company.id },
      ])
      expect(
        yield* database.select().from(objects).orderBy(objects.id)
      ).toEqual(beforeObjects)
      expect(
        yield* database
          .select()
          .from(roleAssignments)
          .orderBy(roleAssignments.id)
      ).toEqual(beforeGrants)
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
