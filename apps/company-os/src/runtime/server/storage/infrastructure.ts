import type { ImageRef } from "#/runtime/model/index.ts"
import type { EventSubject } from "#/runtime/server/events/event-buffer.ts"
import { defineTable, schemaSection } from "#/runtime/server/storage/table.ts"
export const identityBindings = defineTable<{
  issuer: string
  subject: string
  identityId: string
  createdAt: string
}>(
  "identity_bindings",
  {
    issuer: { type: "text" },
    subject: { type: "text" },
    identityId: { type: "text" },
    createdAt: { type: "timestamp with time zone", default: "now()" },
  },
  {
    description:
      "Maps verified provider subjects to local identities. Credentials remain provider-owned.",
    constraints: [
      'primary key ("issuer", "subject")',
      'foreign key ("identity_id") references "interface_identity" ("id") on delete cascade',
    ],
  }
)
export const assetBlobs = defineTable<{ assetId: string; bytes: Uint8Array }>(
  "asset_blobs",
  {
    assetId: { type: "text" },
    bytes: { type: "bytea" },
  },
  {
    description:
      "Local asset payloads; business-facing file metadata lives on the asset record.",
    constraints: [
      'primary key ("asset_id")',
      'foreign key ("asset_id") references "assets" ("id") on delete cascade',
    ],
  }
)
export const assetReferences = defineTable<{
  recordId: string
  field: string
  assetId: string
}>(
  "asset_references",
  {
    recordId: { type: "text" },
    field: { type: "text" },
    assetId: { type: "text" },
  },
  {
    description:
      "Tracks which record fields retain an asset and prevents deletion while referenced.",
    constraints: [
      'primary key ("record_id", "field")',
      'foreign key ("record_id") references "objects" ("id") on delete cascade',
      'foreign key ("asset_id") references "assets" ("id") on delete restrict',
    ],
  }
)
export const eventJournalState = defineTable<{ id: number; position: bigint }>(
  "event_journal_state",
  {
    id: { type: "integer" },
    position: { type: "bigint", default: "0" },
  },
  {
    description:
      "One row locked at commit to assign journal positions in commit order.",
    constraints: ['primary key ("id")'],
  }
)
export const eventJournal = defineTable<{
  position: bigint
  id: string
  transactionId: string
  type: string
  version: number
  subjects: ReadonlyArray<EventSubject>
  actorId: string
  data: unknown
  occurredAt: string
  recordedAt: string
}>(
  "event_journal",
  {
    position: { type: "bigint" },
    id: { type: "text" },
    transactionId: { type: "text" },
    type: { type: "text" },
    version: { type: "integer" },
    subjects: {
      type: "jsonb",
      description:
        "Historical subject snapshots deliberately have no live foreign keys; they survive record deletion.",
    },
    actorId: { type: "text" },
    data: { type: "jsonb" },
    occurredAt: { type: "timestamp with time zone" },
    recordedAt: {
      type: "timestamp with time zone",
      default: "clock_timestamp()",
    },
  },
  {
    description:
      "Append-only business facts recorded atomically with the writes they describe.",
    constraints: ['primary key ("position")', 'unique ("id")'],
  }
)
export const recordSearch = defineTable<{
  id: string
  title: string
  subtitle: string | null
  image: ImageRef | null
  status: string | null
  document: string
}>(
  "record_search",
  {
    id: { type: "text" },
    title: { type: "text" },
    subtitle: { type: "text", nullable: true },
    image: { type: "jsonb", nullable: true },
    status: { type: "text", nullable: true },
    document: { type: "tsvector" },
  },
  {
    description:
      "Rebuildable search projection. Live records remain authoritative for identity and access.",
    constraints: [
      'primary key ("id")',
      'foreign key ("id") references "objects" ("id") on delete cascade',
    ],
  }
)
export const searchIndexState = defineTable<{ id: number; definition: string }>(
  "search_index_state",
  {
    id: { type: "integer" },
    definition: { type: "text" },
  },
  {
    description:
      "Tracks the search projection definition so changes trigger an atomic rebuild.",
    constraints: ['primary key ("id")'],
  }
)
export const seedRuns = defineTable<{
  name: string
  parameters: string
  completedAt: string
}>(
  "seed_runs",
  {
    name: { type: "text" },
    parameters: { type: "text" },
    completedAt: { type: "timestamp with time zone", default: "now()" },
  },
  {
    description:
      "Development scenario receipts, separate from business records and system bootstrap.",
    constraints: ['primary key ("name")'],
  }
)

/** Desired current DDL. Migration history and required bootstrap data have separate owners. */
export const infrastructureStatements = [
  schemaSection("Application infrastructure"),
  ...identityBindings.ddl,
  ...assetBlobs.ddl,
  ...assetReferences.ddl,
  'create index "asset_references_asset_id_idx" on "asset_references" ("asset_id")',
  ...eventJournalState.ddl,
  ...eventJournal.ddl,
  'create index "event_journal_type_position_idx" on "event_journal" ("type", "position")',
  `create function "reject_event_journal_mutation"()\nreturns trigger\nlanguage plpgsql as $$
begin
  raise exception 'The event journal is append-only' using errcode = '55000';
end;
$$`,
  `create trigger "event_journal_append_only"\n  before update or delete on "event_journal"\n  for each statement execute function "reject_event_journal_mutation"()`,
  ...recordSearch.ddl,
  'create index "record_search_document_idx" on "record_search" using gin ("document")',
  ...searchIndexState.ddl,
  ...seedRuns.ddl,
]
