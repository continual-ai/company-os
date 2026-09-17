import { randomUUID } from "node:crypto"

import { Effect } from "effect"

import type { ModelCatalog } from "#/runtime/model/index.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { tableColumns } from "#/runtime/server/storage/index.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

export interface SearchSnippet {
  readonly field: string
  readonly text: string
}

/** Headline parsing is restricted to one page, with one batched query per concrete type. */
export const searchSnippets = Effect.fn("searchSnippets")(function* (
  model: ModelCatalog,
  hits: ReadonlyArray<{ readonly id: string; readonly objectType: string }>,
  query: string
) {
  const context = yield* ModelContext
  const { sql } = yield* SqlDatabase
  const snippets = new Map<string, SearchSnippet[]>()
  const marker = randomUUID()
  const start = `S${marker}S`
  const stop = `E${marker}E`
  const separator = `F${marker}F`
  const options = `MaxFragments=3,MaxWords=35,MinWords=8,StartSel=${start},StopSel=${stop},FragmentDelimiter=${separator}`
  for (const type of new Set(hits.map((hit) => hit.objectType))) {
    const object = model.objects[type]!
    const table = context.table(object)
    const columns = tableColumns(table)
    const fields = object.search!.fields
    if (fields.length === 0) continue
    const ids = hits
      .filter((hit) => hit.objectType === type)
      .map((hit) => hit.id)
    // Our index splits URL/email punctuation. Fall back to that same tokenization if
    // the native headline parser cannot identify a match in the original text.
    const fragments = fields.map(
      (field) => sql`select id, ${field}::text as field,
      case when position(${start} in excerpt) > 0 then excerpt else
        ts_headline('simple', regexp_replace(source, '[^[:alnum:]_]+', ' ', 'g'), ${query}::tsquery, ${options}) end as excerpt
      from (select ${table.columns.id} as id, coalesce(${columns[field]}::text, '') as source,
        ts_headline('simple', coalesce(${columns[field]}::text, ''), ${query}::tsquery, ${options}) as excerpt
        from ${table} where ${table.columns.id} in (${sql.csv(ids.map((id) => sql`${id}`))}) ${field === object.display.title ? sql`and length(${columns[field]}::text) > 300` : sql``}) excerpts`
    )
    const rows = yield* sql<{
      id: string
      field: string
      excerpt: string
    }>`${sql.join(" union all ")(fragments)}`
    for (const { id, field, excerpt } of rows) {
      for (const fragment of excerpt.split(separator)) {
        if (!fragment.includes(start)) continue
        const clean = fragment
          .replaceAll(start, "")
          .replaceAll(stop, "")
          .replace(/\s+/g, " ")
          .trim()
        // Center the hard character bound near the match rather than dropping a late match.
        const before = fragment
          .slice(0, fragment.indexOf(start))
          .replaceAll(stop, "")
          .replace(/\s+/g, " ")
          .trimStart()
        const matchOffset = Array.from(before).length
        const characters = Array.from(clean)
        let offset = Math.max(0, matchOffset - 80)
        while (
          offset < matchOffset &&
          offset > 0 &&
          characters[offset - 1] !== " "
        )
          offset++
        let end = Math.min(characters.length, offset + 248)
        if (end < characters.length) {
          const boundary = characters.lastIndexOf(" ", end)
          if (boundary > Math.max(matchOffset, offset + 160)) end = boundary
        }
        const text = `${offset > 0 ? "…" : ""}${characters.slice(offset, end).join("").trim()}${characters.length > end ? "…" : ""}`
        const current = snippets.get(id) ?? []
        if (
          text &&
          current.length < 3 &&
          !current.some((snippet) => snippet.text === text)
        )
          current.push({ field, text })
        snippets.set(id, current)
      }
    }
  }
  return snippets
})
