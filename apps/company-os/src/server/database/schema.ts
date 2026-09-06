import { makePostgresSchema } from "@company/postgres"
import type { ImageRef } from "@company/runtime"
import { Model } from "company-os/model"
import { sql } from "drizzle-orm"
import {
  bigint,
  integer,
  jsonb,
  customType,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import type { EventSubject } from "@/server/events/event-buffer"

export const Storage = makePostgresSchema(Model)

// Named aliases support custom queries. Drizzle Kit reads the generated,
// exhaustive projection in tools/drizzle-schema.generated.ts.
export const objects = Storage.core.objects
export const recordAliases = Storage.core.recordAliases
export const roots = Storage.core.roots
export const actors = Storage.interfaces.actor
export const authorizationScopes = Storage.interfaces.authorizationScope
export const identities = Storage.interfaces.identity
export const noteSubjects = Storage.interfaces.noteSubject
export const parties = Storage.interfaces.party
export const principals = Storage.interfaces.principal
export const principalSets = Storage.objects.principalSet
export const anonymousActors = Storage.objects.anonymousActor
export const companies = Storage.objects.company
export const contacts = Storage.objects.contact
export const deals = Storage.objects.deal
export const groupMemberships = Storage.objects.groupMembership
export const groups = Storage.objects.group
export const leads = Storage.objects.lead
export const lineItems = Storage.objects.lineItem
export const notes = Storage.objects.note
export const roleAssignments = Storage.objects.roleAssignment
export const roles = Storage.objects.role
export const serviceAccounts = Storage.objects.serviceAccount
export const users = Storage.objects.user
export const contactCompanies = Storage.linkTables.contactCompanies
export const dealCompanies = Storage.linkTables.dealCompanies
export const contactPrimaryCompanies = Storage.linkTables.contactPrimaryCompany
export const noteSubjectLinks = Storage.linkTables.noteSubjects
export const relations = Storage.relations

/** Maps provider subjects to App principals; credentials remain provider-owned. */
export const identityBindings = pgTable(
  "identity_bindings",
  {
    issuer: text("issuer").notNull(),
    subject: text("subject").notNull(),
    identityId: text("identity_id")
      .notNull()
      .references(() => identities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.issuer, table.subject] })]
)

export const assets = Storage.objects.asset
export const issues = Storage.objects.issue
const bytes = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => "bytea",
  toDriver: (value) => Buffer.from(value),
  fromDriver: (value) => new Uint8Array(value),
})
export const assetBlobs = pgTable("asset_blobs", {
  assetId: text("asset_id")
    .primaryKey()
    .references(() => assets.id, { onDelete: "cascade" }),
  bytes: bytes("bytes").notNull(),
})
export const assetReferences = pgTable(
  "asset_references",
  {
    recordId: text("record_id")
      .notNull()
      .references(() => objects.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.recordId, table.field] }),
    index("asset_references_asset_id_idx").on(table.assetId),
  ]
)

/** One row, locked only while assigning positions at the end of a writing transaction. */
export const eventJournalState = pgTable("event_journal_state", {
  id: integer("id").primaryKey(),
  position: bigint("position", { mode: "bigint" }).notNull().default(0n),
})

/** Historical subjects deliberately have no live foreign keys; snapshots survive record deletion. */
export const eventJournal = pgTable(
  "event_journal",
  {
    position: bigint("position", { mode: "bigint" }).primaryKey(),
    id: text("id").notNull().unique(),
    transactionId: text("transaction_id").notNull(),
    type: text("type").notNull(),
    version: integer("version").notNull(),
    subjects: jsonb("subjects").$type<ReadonlyArray<EventSubject>>().notNull(),
    actorId: text("actor_id").notNull(),
    data: jsonb("data").$type<unknown>().notNull(),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (table) => [
    index("event_journal_type_position_idx").on(table.type, table.position),
  ]
)

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" })

/** Derived search documents. Live objects remain authoritative for identity and access. */
export const recordSearch = pgTable(
  "record_search",
  {
    id: text("id")
      .primaryKey()
      .references(() => objects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    image: jsonb("image").$type<ImageRef>(),
    status: text("status"),
    document: tsvector("document").notNull(),
  },
  (table) => [index("record_search_document_idx").using("gin", table.document)]
)

/** Changes to the source-owned search projection trigger one atomic rebuild during migration. */
export const searchIndexState = pgTable("search_index_state", {
  id: integer("id").primaryKey(),
  definition: text("definition").notNull(),
})
