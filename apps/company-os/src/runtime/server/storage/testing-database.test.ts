import { randomUUID } from "node:crypto"

import { PgClient } from "@effect/sql-pg"
import { it } from "@effect/vitest"
import { ConfigProvider, Effect, Exit } from "effect"
import { expect } from "vitest"

import {
  TestDatabase,
  testDatabaseClient,
} from "#/runtime/server/storage/testing.ts"

it.live("serializes builders of one shared template", () =>
  Effect.gen(function* () {
    let builds = 0
    const initialize = (url: string) =>
      Effect.gen(function* () {
        const sql = yield* PgClient.PgClient
        builds++
        yield* sql`create table template_probe (id integer)`
      }).pipe(Effect.provide(testDatabaseClient(url)))
    const key = randomUUID()
    const templates = yield* Effect.all(
      Array.from({ length: 4 }, () =>
        TestDatabase.createTemplate(initialize, key)
      ),
      { concurrency: "unbounded" }
    )
    expect(builds).toBe(1)
    expect(
      new Set(templates.map(({ databaseName }) => databaseName)).size
    ).toBe(1)
    const database = yield* TestDatabase.clone(templates[0]!)
    yield* Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      expect(
        yield* sql`select count(*)::integer as count from template_probe`
      ).toEqual([{ count: 0 }])
    }).pipe(Effect.provide(testDatabaseClient(database.url)))
  })
)

const failingInitializer = (url: string) =>
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient
    yield* sql`create table partial_probe (id integer)`
    return yield* Effect.fail("initialization failed")
  }).pipe(Effect.provide(testDatabaseClient(url)))

it.live("drops a failed initialization before another builder retries", () =>
  Effect.gen(function* () {
    const key = randomUUID()
    expect(
      Exit.isFailure(
        yield* TestDatabase.createTemplate(failingInitializer, key).pipe(
          Effect.exit
        )
      )
    ).toBe(true)
    const template = yield* TestDatabase.createTemplate(
      ["create table complete_probe (id integer)"],
      key
    )
    yield* Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      expect(
        yield* sql`select to_regclass('partial_probe')::text as partial, to_regclass('complete_probe')::text as complete`
      ).toEqual([{ partial: null, complete: "complete_probe" }])
    }).pipe(Effect.provide(testDatabaseClient(TestDatabase.url(template))))
  })
)

it.live(
  "keeps database setup independent of application configuration overrides",
  () =>
    Effect.gen(function* () {
      const template = yield* TestDatabase.createTemplate([]).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            DATABASE_URL: "postgresql://localhost:1/unreachable",
          })
        )
      )
      expect(new URL(template.adminUrl).port).not.toBe("1")
    })
)

it.live("cleanup leaves databases from another run intact", () =>
  Effect.gen(function* () {
    const template = yield* TestDatabase.createTemplate([])
    const first = randomUUID().replaceAll("-", "").slice(0, 12)
    const second = randomUUID().replaceAll("-", "").slice(0, 12)
    const firstName = `company_os_test_${first}_database_00000000000000000000`
    const secondName = `company_os_test_${second}_database_00000000000000000000`
    yield* Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      yield* sql`create database ${sql(firstName)} template template0`
      yield* sql`create database ${sql(secondName)} template template0`
      yield* TestDatabase.dropAll(first)
      expect(
        yield* sql`select datname from pg_database where datname in (${firstName}, ${secondName})`
      ).toEqual([{ datname: secondName }])
    }).pipe(
      Effect.provide(testDatabaseClient(template.adminUrl)),
      Effect.ensuring(
        Effect.all([
          TestDatabase.dropAll(first),
          TestDatabase.dropAll(second),
        ]).pipe(Effect.orDie)
      )
    )
  })
)
