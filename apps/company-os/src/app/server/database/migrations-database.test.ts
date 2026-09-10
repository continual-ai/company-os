import { PgClient } from "@effect/sql-pg"
import { Effect, Exit, Layer, Redacted } from "effect"
import * as Migrator from "effect/unstable/sql/Migrator"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import { expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import {
  applyMigrations,
  verifyDatabaseModel,
} from "#/app/server/database/migrations.ts"
import { migrations } from "#/app/server/database/migrations/index.ts"
import { schemaSql } from "#/app/server/database/schema.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { pgTypes } from "#/runtime/server/storage/index.ts"
import { TestDatabase } from "#/runtime/server/storage/testing.ts"
import { testDatabase } from "#/runtime/testing/database.ts"
import { readSchemaCatalog } from "#/runtime/testing/schema-catalog.ts"

const application = testDatabase(
  Model,
  async (url) => {
    await Effect.runPromise(
      Effect.scoped(
        applyMigrations().pipe(
          Effect.provide(
            Database.layer.pipe(
              Layer.provideMerge(ModelContext.layer(Model)),
              Layer.provide(
                PgClient.layer({ url: Redacted.make(url), types: pgTypes })
              )
            )
          )
        )
      )
    )
  },
  `migrations:${JSON.stringify(migrations)}`
)
const empty = testDatabase(Model, "")

it("replayed migrations match the declared structure, including indexes, functions, and triggers", async () => {
  const declared = await TestDatabase.createTemplate(schemaSql)
  try {
    const [migrated, expected] = await Promise.all([
      readSchemaCatalog(TestDatabase.url(await application.template())),
      readSchemaCatalog(TestDatabase.url(declared)),
    ])
    expect(migrated.tables.length).toBeGreaterThan(10)
    expect(migrated).toEqual(expected)
  } finally {
    await TestDatabase.drop(declared)
  }
})

application.test("does not reapply completed migrations", () =>
  Effect.gen(function* () {
    yield* verifyDatabaseModel()
    yield* applyMigrations()
    yield* applyMigrations()
    const { sql } = yield* Database
    expect(
      yield* sql`select migration_id as id from company_os_migrations`
    ).toEqual(migrations.map(({ id }) => ({ id })))
    expect(yield* sql`select id from event_journal_state`).toEqual([{ id: 1 }])
  })
)

application.test(
  "rolls back a failing whole-file migration, including function bodies",
  () =>
    Effect.gen(function* () {
      const { sql } = yield* Database
      const result = yield* Migrator.make({})({
        table: "test_migrations",
        loader: Migrator.fromRecord({
          "1_failure": Effect.gen(function* () {
            const client = yield* SqlClient.SqlClient
            yield* client.unsafe(`
            -- Semicolons inside comments and function bodies are not delimiters;
            create table migration_probe (id integer);
            create function migration_probe() returns integer language plpgsql as $$
            begin
              insert into migration_probe values (1);
              return 1;
            end;
            $$;
            select migration_probe();
            select 1 / 0;
          `)
          }),
        }),
      }).pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.exit)
      expect(Exit.isFailure(result)).toBe(true)
      expect(
        yield* sql`select to_regclass('migration_probe') as table_name,
      to_regprocedure('migration_probe()') as function_name`
      ).toEqual([{ table_name: null, function_name: null }])
    })
)

empty.test("refuses to start before the committed baseline is applied", () =>
  Effect.gen(function* () {
    expect(Exit.isFailure(yield* verifyDatabaseModel().pipe(Effect.exit))).toBe(
      true
    )
    yield* applyMigrations()
    yield* verifyDatabaseModel()
    const { sql } = yield* Database
    expect(yield* sql`select to_regclass('objects')::text as registry`).toEqual(
      [{ registry: "objects" }]
    )
  })
)

it("archives retired grants while preserving business data, files, identities and historical events", async () => {
  const template = await TestDatabase.createTemplate(
    migrations
      .slice(0, 3)
      .map(({ sql }) => sql)
      .join("\n")
  )
  const { Client } = await import("pg")
  const client = new Client({ connectionString: TestDatabase.url(template) })
  try {
    await client.connect()
    await client.query("begin")
    await client.query(`
      insert into objects (id, object_type, parent_id, ancestor_ids, created_by_id, updated_by_id) values
        ('platform_system', 'root', null, '{}', 'service_account_system', 'service_account_system'),
        ('service_account_system', 'serviceAccount', 'platform_system', '{platform_system}', 'service_account_system', 'service_account_system'),
        ('company_retained', 'company', 'platform_system', '{platform_system}', 'service_account_system', 'service_account_system'),
        ('deal_retained', 'deal', 'company_retained', '{company_retained,platform_system}', 'service_account_system', 'service_account_system'),
        ('item_retained', 'lineItem', 'deal_retained', '{deal_retained,company_retained,platform_system}', 'service_account_system', 'service_account_system'),
        ('asset_retained', 'asset', 'company_retained', '{company_retained,platform_system}', 'service_account_system', 'service_account_system'),
        ('role_retained', 'role', 'platform_system', '{platform_system}', 'service_account_system', 'service_account_system'),
        ('grant_retained', 'roleAssignment', 'company_retained', '{company_retained,platform_system}', 'service_account_system', 'service_account_system');
      insert into roots (id) values ('platform_system');
      insert into interface_actor (id) values ('service_account_system');
      insert into interface_identity (id) values ('service_account_system');
      insert into interface_principal (id) values ('service_account_system');
      insert into interface_authorization_scope (id) values ('platform_system'), ('company_retained');
      insert into service_accounts (id, parent_id, name) values ('service_account_system', 'platform_system', 'System');
      insert into companies (id, parent_id, name) values ('company_retained', 'platform_system', 'Retained company');
      insert into deals (id, parent_id, name, amount) values ('deal_retained', 'company_retained', 'Retained deal', '{"currency":"USD","amount":"123.45"}');
      insert into line_items (id, parent_id, name) values ('item_retained', 'deal_retained', 'Retained line');
      insert into assets (id, parent_id, name, content_type, size) values ('asset_retained', 'company_retained', 'retained.txt', 'text/plain', 4);
      insert into asset_blobs (asset_id, bytes) values ('asset_retained', decode('74657374', 'hex'));
      insert into deal_companies (forward_id, reverse_id) values ('deal_retained', 'company_retained');
      insert into roles (id, parent_id, name, scope_type, permissions) values ('role_retained', 'platform_system', 'Old role', 'company', '{deal.get}');
      insert into role_assignments (id, parent_id, principal_id, role_id) values ('grant_retained', 'company_retained', 'service_account_system', 'role_retained');
      insert into identity_bindings (issuer, subject, identity_id) values ('test', 'system', 'service_account_system');
      insert into record_aliases (alias, object_id) values ('old-role', 'role_retained');
      insert into event_journal (position, id, transaction_id, type, version, subjects, actor_id, data, occurred_at) values (1, 'event_retained', 'transaction_retained', 'deal.created', 1, '[{"id":"deal_retained","objectType":"deal","ancestorIds":["company_retained","platform_system"]}]', 'service_account_system', '{}', now());
    `)
    await client.query(`
      insert into objects (id, object_type, parent_id, created_by_id, updated_by_id)
        select 'module_' || module_id, 'moduleSetting', 'platform_system', 'service_account_system', 'service_account_system'
        from unnest(array['access', 'assets', 'platform', 'notes']) as module_id;
      insert into module_settings (id, parent_id, module_id, enabled)
        select 'module_' || module_id, 'platform_system', module_id, module_id <> 'notes'
        from unnest(array['access', 'assets', 'platform', 'notes']) as module_id;
    `)
    await client.query("commit")
    const before = await client.query(
      "select * from event_journal order by position"
    )
    await client.query("begin")
    for (const migration of migrations.slice(3))
      await client.query(migration.sql)
    await client.query("commit")
    expect(
      (
        await client.query(
          "select module_id, enabled from module_settings order by module_id"
        )
      ).rows
    ).toEqual([
      { module_id: "notes", enabled: false },
      { module_id: "platform", enabled: true },
    ])
    expect(
      (
        await client.query(
          "select id from objects where id in ('module_access', 'module_assets')"
        )
      ).rows
    ).toEqual([])
    expect(
      (await client.query("select id, name from service_accounts")).rows
    ).toEqual([{ id: "service_account_system", name: "System" }])
    expect(
      (await client.query("select name, parent_id, amount from deals")).rows
    ).toEqual([
      {
        name: "Retained deal",
        parent_id: "platform_system",
        amount: { currency: "USD", amount: "123.45" },
      },
    ])
    expect(
      (
        await client.query(
          "select parent_id from objects where id = 'item_retained'"
        )
      ).rows
    ).toEqual([{ parent_id: "deal_retained" }])
    expect(
      (await client.query("select * from deal_companies")).rows
    ).toHaveLength(1)
    expect(
      (
        await client.query(
          "select encode(bytes, 'hex') as bytes from asset_blobs"
        )
      ).rows
    ).toEqual([{ bytes: "74657374" }])
    expect(
      (await client.query("select * from identity_bindings")).rows
    ).toHaveLength(1)
    expect(
      (
        await client.query(
          "select data->>'name' as name, aliases from company_os_archive.access_v1 where object->>'id' = 'role_retained'"
        )
      ).rows
    ).toMatchObject([
      {
        name: "Old role",
        aliases: [{ alias: "old-role", object_id: "role_retained" }],
      },
    ])
    expect(
      (await client.query("select * from event_journal order by position")).rows
    ).toEqual(before.rows)
    expect(
      (
        await client.query(
          "select id from objects where object_type in ('role', 'roleAssignment')"
        )
      ).rows
    ).toEqual([])
  } finally {
    await client.end()
    await TestDatabase.drop(template)
  }
})

it("isolates retired configuration archives for applications sharing a database", async () => {
  const template = await TestDatabase.createTemplate("")
  const { Client } = await import("pg")
  const client = new Client({ connectionString: TestDatabase.url(template) })
  try {
    await client.connect()
    for (const schema of ["first_project", "second_project"]) {
      await client.query(`create schema ${schema}`)
      await client.query(`set search_path to ${schema}, public`)
      await client.query("begin")
      for (const migration of migrations) await client.query(migration.sql)
      await client.query("commit")
      expect(
        (await client.query("select count(*)::integer as count from objects"))
          .rows
      ).toEqual([{ count: 0 }])
      expect(
        (await client.query("select to_regclass('roles') as retired")).rows
      ).toEqual([{ retired: null }])
      expect(
        (
          await client.query(`
        select count(*)::integer as count from information_schema.tables
        where table_schema = 'company_os_archive_' || md5(current_schema())
          and table_name in ('access_v1', 'scope_placement_v1', 'identity_state_v1')
      `)
        ).rows
      ).toEqual([{ count: 3 }])
    }
  } finally {
    await client.end()
    await TestDatabase.drop(template)
  }
})
