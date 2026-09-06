import {
  eq,
  getTableColumns,
  sql,
  type AnyRelations,
  type SQL,
} from "drizzle-orm"
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres"
import { Effect } from "effect"
import { SqlError, UnknownError } from "effect/unstable/sql/SqlError"

import { searchableObjects } from "@/records"

import { objects, recordSearch, searchIndexState, Storage } from "./schema"

/** Shared tokenization makes email domains, URLs, hyphens, and names searchable as word prefixes. */
export function searchVector(text: SQL) {
  return sql`to_tsvector('simple', regexp_replace(coalesce(${text}, ''), '[^[:alnum:]_]+', ' ', 'g'))`
}

function project(object: (typeof searchableObjects)[number], where: SQL) {
  const table = Storage.objects[object.id]
  const columns = getTableColumns(table)
  const display = (field: string | undefined) =>
    field === undefined ? sql`null` : sql`${columns[field]}`
  const title = sql`coalesce(nullif(${display(object.display.title)}::text, ''), ${table.id})`
  const vectors = object.search!.fields.map((field) => {
    const vector = searchVector(sql`${columns[field]}`)
    return field === object.display.title
      ? sql`setweight(${vector}, 'A')`
      : sql`setweight(${vector}, 'B')`
  })
  return sql`insert into ${recordSearch} (id, title, subtitle, image, status, document)
    select ${table.id}, left(${title}, 300), left(${display(object.display.subtitle)}::text, 300),
      ${display(object.display.image)}::jsonb, ${display(object.display.status)}::text,
      ${sql.join(vectors, sql` || `)}
    from ${table} where ${where} order by ${table.id}
    on conflict (id) do update set title = excluded.title, subtitle = excluded.subtitle,
      image = excluded.image, status = excluded.status, document = excluded.document`
}

/** Called inside the writing transaction, including custom SQL facts. Deletions cascade from objects. */
export function updateSearchIndex<R extends AnyRelations>(
  database: EffectPgDatabase<R>,
  subjects: ReadonlyArray<{ readonly id: string; readonly objectType: string }>
) {
  return Effect.gen(function* () {
    const searchableTypes = new Set<string>(
      searchableObjects.map((object) => object.id)
    )
    const targets = [
      ...new Set(
        subjects
          .filter((subject) => searchableTypes.has(subject.objectType))
          .map((subject) => subject.id)
      ),
    ].sort()
    if (targets.length === 0) return
    // Serialize projections with business writers so a related fact cannot publish an older snapshot.
    yield* database.execute(
      sql`select id from ${objects} where id in (${sql.join(
        targets.map((id) => sql`${id}`),
        sql`, `
      )}) order by id for no key update`
    )
    for (const object of searchableObjects) {
      const ids = [
        ...new Set(
          subjects
            .filter((subject) => subject.objectType === object.id)
            .map((subject) => subject.id)
        ),
      ].sort()
      if (ids.length === 0) continue
      const table = Storage.objects[object.id]
      yield* database.execute(
        project(
          object,
          sql`${table.id} in (${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `
          )})`
        )
      )
    }
  }).pipe(
    Effect.mapError(
      (cause) =>
        new SqlError({
          reason: new UnknownError({
            cause,
            message: "Could not update the transaction's search index.",
          }),
        })
    )
  )
}

const definition = JSON.stringify({
  version: 2,
  objects: searchableObjects.map((object) => ({
    id: object.id,
    collection: object.collection,
    search: object.search,
    display: object.display,
  })),
})

/** Migration-time rebuild when indexed fields change. Locks source tables while replacing the disposable projection. */
export function ensureSearchIndex<R extends AnyRelations>(
  database: EffectPgDatabase<R>,
  force = false
) {
  return Effect.gen(function* () {
    const [current] = yield* database
      .select()
      .from(searchIndexState)
      .where(eq(searchIndexState.id, 1))
    if (!force && current?.definition === definition) return
    yield* database.transaction(() =>
      Effect.gen(function* () {
        // Migration maintenance briefly pauses writers; readers continue seeing the old committed index.
        // Lock sources before the projection so a rebuild cannot overwrite a concurrent business write.
        const tables = [
          objects,
          ...searchableObjects.map((object) => Storage.objects[object.id]),
          recordSearch,
          searchIndexState,
        ]
        yield* database.execute(
          sql`lock table ${sql.join(tables, sql`, `)} in share row exclusive mode`
        )
        const [locked] = yield* database
          .select()
          .from(searchIndexState)
          .where(eq(searchIndexState.id, 1))
        if (!force && locked?.definition === definition) return
        yield* database.delete(recordSearch)
        for (const object of searchableObjects)
          yield* database.execute(project(object, sql`true`))
        yield* database
          .insert(searchIndexState)
          .values({ id: 1, definition })
          .onConflictDoUpdate({
            target: searchIndexState.id,
            set: { definition },
          })
      })
    )
  })
}
