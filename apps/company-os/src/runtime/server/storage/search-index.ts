import { Effect } from "effect"
import { SqlError, UnknownError } from "effect/unstable/sql/SqlError"
import type { Constructor } from "effect/unstable/sql/Statement"
import type { Fragment } from "effect/unstable/sql/Statement"

import type { ObjectType } from "#/runtime/model/index.ts"
import type { ModelContext } from "#/runtime/server/model-context.ts"
import { insertValues, assignments } from "#/runtime/server/storage/index.ts"
import type { Column } from "#/runtime/server/storage/index.ts"
import {
  tableColumns,
  tableProjection,
  type TableRow,
  conflictColumns,
  type PostgresDatabase,
} from "#/runtime/server/storage/index.ts"
import {
  recordSearch,
  searchIndexState,
} from "#/runtime/server/storage/infrastructure.ts"

/** Shared tokenization makes email domains, URLs, hyphens, and names searchable as word prefixes. */
export function searchVector(sql: Constructor, text: Fragment) {
  return sql`to_tsvector('simple', regexp_replace(coalesce(${text}, ''), '[^[:alnum:]_]+', ' ', 'g'))`
}

function project(
  sql: Constructor,
  object: ObjectType,
  where: Fragment,
  context: typeof ModelContext.Service
) {
  const table = context.table(object)
  const columns: Readonly<Record<string, Column>> = tableColumns(table)
  const display = (field: string | undefined) =>
    field === undefined ? sql`null` : sql`${columns[field]}`
  const title = sql`coalesce(nullif(${display(object.display.title)}::text, ''), ${table.columns.id})`
  const vectors = object.search!.fields.map((field) => {
    const vector = searchVector(sql, sql`${columns[field]}`)
    return field === object.display.title
      ? sql`setweight(${vector}, 'A')`
      : sql`setweight(${vector}, 'B')`
  })
  return sql`insert into ${recordSearch} (id, title, subtitle, image, status, document)
    select ${table.columns.id}, left(${title}, 300), left(${display(object.display.subtitle)}::text, 300),
      ${display(object.display.image)}::jsonb, ${display(object.display.status)}::text,
      ${sql.join(" || ")(vectors)}

          from ${table}
          where ${where}
          order by ${table.columns.id}

          on conflict (id)
          do update set title = excluded.title, subtitle = excluded.subtitle,
      image = excluded.image, status = excluded.status, document = excluded.document`
}

/** Called inside the writing transaction, including custom SQL facts. Deletions cascade from objects. */
export function updateSearchIndex(
  database: PostgresDatabase,
  subjects: ReadonlyArray<{ readonly id: string; readonly objectType: string }>,
  context: typeof ModelContext.Service
) {
  const sql = database.sql
  const objects = context.storage.core.objects
  const searchableObjects = Object.values(context.model.objects).filter(
    (object) => object.search !== undefined
  )

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
    yield* sql`select id
          from ${objects}
          where id in (${sql.join(", ", false)(targets.map((id) => sql`${id}`))})
          order by id for no key update`
    for (const object of searchableObjects) {
      const ids = [
        ...new Set(
          subjects
            .filter((subject) => subject.objectType === object.id)
            .map((subject) => subject.id)
        ),
      ].sort()
      if (ids.length === 0) continue
      const table = context.table(object)
      yield* sql`${project(
        sql,
        object,
        sql`${table.columns.id} in (${sql.join(", ", false)(ids.map((id) => sql`${id}`))})`,
        context
      )}`
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

/** Migration-time rebuild when indexed fields change. Locks source tables while replacing the disposable projection. */
export function ensureSearchIndex(
  database: PostgresDatabase,
  context: typeof ModelContext.Service,
  force = false
) {
  const sql = database.sql
  const objects = context.storage.core.objects
  const searchableObjects = Object.values(context.model.objects).filter(
    (object) => object.search !== undefined
  )

  const definition = JSON.stringify({
    version: 2,
    objects: searchableObjects.map((object) => ({
      id: object.id,
      collection: object.collection,
      search: object.search,
      display: object.display,
    })),
  })

  return Effect.gen(function* () {
    const [current] = yield* sql<
      TableRow<typeof searchIndexState>
    >`select ${tableProjection(searchIndexState)}
          from ${searchIndexState}
          where ${searchIndexState.columns.id} = ${1}`
    if (!force && current?.definition === definition) return
    yield* database.transaction(() =>
      Effect.gen(function* () {
        // Migration maintenance briefly pauses writers; readers continue seeing the old committed index.
        // Lock sources before the projection so a rebuild cannot overwrite a concurrent business write.
        const tables = [
          objects,
          ...searchableObjects.map((object) => context.table(object)),
          recordSearch,
          searchIndexState,
        ]
        yield* sql`lock table ${sql.join(", ", false)(tables)} in share row exclusive mode`
        const [locked] = yield* sql<
          TableRow<typeof searchIndexState>
        >`select ${tableProjection(searchIndexState)}
          from ${searchIndexState}
          where ${searchIndexState.columns.id} = ${1}`
        if (!force && locked?.definition === definition) return
        yield* sql`delete
          from ${recordSearch}`
        for (const object of searchableObjects)
          yield* sql`${project(sql, object, sql`true`, context)}`
        yield* sql`insert into ${searchIndexState} ${insertValues(sql, searchIndexState, { id: 1, definition })}
          on conflict (${conflictColumns(sql, searchIndexState.columns.id)})
          do update set ${assignments(sql, searchIndexState, { definition })}`
      })
    )
  })
}
