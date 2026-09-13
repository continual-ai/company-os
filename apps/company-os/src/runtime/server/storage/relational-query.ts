import type { Constructor, Fragment } from "effect/unstable/sql/Statement"

import { modelLinkTraversals } from "#/runtime/model/definition/model.ts"
import type { LinkFilter } from "#/runtime/model/definition/request.ts"
import {
  modelTypeAccepts,
  type ModelCatalog,
  type ObjectType,
  type PropertyDefinition,
} from "#/runtime/model/index.ts"
import {
  queryProperty,
  type QueryType,
  resolveQueryField,
} from "#/runtime/model/query-fields.ts"
import {
  makeObjectQueryCompiler,
  invalidListRequest,
  type QueryFilter,
} from "#/runtime/server/storage/object-query.ts"
import type { PostgresStorage } from "#/runtime/server/storage/schema.ts"
import {
  tableColumns,
  quoteIdentifier as q,
  type Column,
} from "#/runtime/server/storage/table.ts"

function hasFilter(
  value: QueryFilter | Readonly<Record<string, never>>
): value is QueryFilter {
  return ["field", "link", "and", "or", "not"].some((key) =>
    Object.hasOwn(value, key)
  )
}

export interface QueryField {
  readonly column: Column
  readonly property?: PropertyDefinition | undefined
}

const expression = (fragment: Fragment, name: string, type: string): Column =>
  Object.assign(fragment, { name, type })

/** Compiles bounded traversals as correlated SQL. Related filters select parents, not preview members. */
export function relationalQuery(
  sql: Constructor,
  storage: PostgresStorage<ModelCatalog>,
  root: QueryType,
  rootId: Column
) {
  let sequence = 0
  const column = (alias: string, name: string, type: string): Column =>
    Object.assign(sql.literal(`${q(alias)}.${q(name)}`), { name, type })
  const scope = (object: QueryType, sourceId: Column, depth: number) => {
    const traversalFor = (key: string) => {
      if (depth >= 3)
        throw invalidListRequest(
          root,
          "Relationship paths may contain at most three traversals."
        )
      const result = modelLinkTraversals(storage.model, object.id).find(
        ({ traversal }) => traversal.key === key
      )
      if (!result)
        throw invalidListRequest(
          root,
          `Unknown relationship '${object.id}.${key}'.`
        )
      return result
    }
    const validateSharedField = (
      relation: ReturnType<typeof traversalFor>,
      field: string
    ) => {
      if (relation.target.from.kind !== "interface") return
      const target = storage.model.interfaces[relation.target.from.typeId]!
      const [key, ...tail] = field.split(".")
      const sharedRelationship = Object.values(storage.model.links).some(
        (link) =>
          [link.forward, link.reverse].some(
            (end) =>
              end.from.kind === "interface" &&
              end.from.typeId === target.id &&
              end.key === key
          )
      )
      if (
        tail.length > 0
          ? !sharedRelationship
          : !Object.hasOwn(target.properties, field) &&
            ![
              "id",
              "createdAt",
              "updatedAt",
              "createdBy",
              "updatedBy",
              "systemManaged",
            ].includes(field)
      )
        throw invalidListRequest(
          root,
          `Field '${field}' is not declared by Interface '${target.id}'.`
        )
    }
    const branches = (
      relationshipKey: string,
      body: (
        target: ObjectType,
        id: Column,
        columns: Record<string, Column>,
        mapping: Readonly<Record<string, string>>
      ) => Fragment
    ) => {
      const relation = traversalFor(relationshipKey)
      const table = storage.linkTables[relation.link.id]!
      const targetType = relation.target.from.typeId
      const candidates = Object.values(storage.model.objects).filter((target) =>
        modelTypeAccepts(storage.model, target.id, targetType)
      )
      return candidates.map((target) => {
        const edgeAlias = `edge_${sequence++}`,
          valueAlias = `value_${sequence++}`,
          identityAlias = `identity_${sequence++}`
        const targetTable = storage.objects[target.id]!
        const id = column(identityAlias, "id", "text")
        const mapping = target.interfaces[targetType]?.propertyMapping ?? {}
        const columns: Record<string, Column> = Object.fromEntries(
          Object.entries(tableColumns(targetTable)).map(([key, value]) => [
            key,
            column(valueAlias, value.name, value.type),
          ])
        )
        for (const key of [
          "id",
          "createdAt",
          "updatedAt",
          "createdById",
          "updatedById",
          "systemManaged",
        ] as const) {
          const value = storage.core.objects.columns[key]
          columns[
            key === "createdById"
              ? "createdBy"
              : key === "updatedById"
                ? "updatedBy"
                : key
          ] = column(identityAlias, value.name, value.type)
        }
        const source =
          relation.direction === "forward" ? "forward_id" : "reverse_id"
        const destination =
          relation.direction === "forward" ? "reverse_id" : "forward_id"
        return sql`select ${body(target, id, columns, mapping)} from ${table} as ${sql.literal(q(edgeAlias))}
          join ${targetTable} as ${sql.literal(q(valueAlias))} on ${column(edgeAlias, destination, "text")} = ${column(valueAlias, "id", "text")}
          join ${storage.core.objects} as ${sql.literal(q(identityAlias))} on ${id} = ${column(valueAlias, "id", "text")}
          where ${column(edgeAlias, source, "text")} = ${sourceId}`
      })
    }
    const field = (
      path: string,
      aggregate?: "count" | "min" | "max"
    ): QueryField => {
      let resolvedField: ReturnType<typeof resolveQueryField>
      try {
        resolvedField = resolveQueryField(
          storage.model,
          object,
          path,
          aggregate
        )
      } catch (error) {
        throw invalidListRequest(
          root,
          error instanceof Error ? error.message : "Invalid relationship field."
        )
      }
      if (resolvedField.count) aggregate = "count"
      const [key, ...remaining] = path.split(".")
      const relation = traversalFor(key!)
      if (relation.traversal.max !== 1 && aggregate === undefined)
        throw invalidListRequest(
          root,
          `Plural relationship '${key}' requires a quantifier or aggregate.`
        )
      let property: PropertyDefinition | undefined = resolvedField.property
      let valueType = "text"
      const selects = branches(key!, (target, id, columns, targetMapping) => {
        if (aggregate === "count") return sql`1 as value`
        const rest = remaining.join(".")
        const mapped = targetMapping[rest] ?? rest
        validateSharedField(relation, rest)
        const resolved = rest.includes(".")
          ? scope(target, id, depth + 1).field(rest)
          : { column: columns[mapped], property: queryProperty(target, mapped) }
        if (!resolved.column)
          throw invalidListRequest(root, `Unknown related field '${path}'.`)
        property = resolvedField.property
        valueType = resolved.column.type
        return sql`${resolved.column} as value`
      })
      if (selects.length === 0)
        throw invalidListRequest(
          root,
          `Relationship '${key}' has no concrete targets.`
        )
      const rows = sql.join(" union all ")(selects)
      if (aggregate !== undefined) {
        const fn = sql.literal(aggregate)
        return {
          column: expression(
            sql`(select ${fn}(value) from (${rows}) related_values)`,
            path,
            aggregate === "count" ? "bigint" : valueType
          ),
          property,
        }
      }
      return { column: expression(sql`(${rows})`, path, valueType), property }
    }
    const filter = (input: LinkFilter): Fragment => {
      const relation = traversalFor(input.link)
      const quantifier =
        "some" in input
          ? "some"
          : "none" in input
            ? "none"
            : "every" in input
              ? "every"
              : undefined
      if (quantifier === undefined) {
        const table = storage.linkTables[relation.link.id]!
        const source =
          relation.direction === "forward"
            ? table.columns.forwardId
            : table.columns.reverseId
        const target =
          relation.direction === "forward"
            ? table.columns.reverseId
            : table.columns.forwardId
        const match =
          "contains" in input
            ? sql`${target} = coalesce((select object_id from record_aliases where alias = ${input.contains}), ${input.contains})`
            : sql`true`
        const exists = sql`exists (select 1 from ${table} where ${source} = ${sourceId} and ${match})`
        return "isEmpty" in input ? sql`not (${exists})` : exists
      }
      const nested =
        "some" in input
          ? input.some
          : "none" in input
            ? input.none
            : "every" in input
              ? input.every
              : {}
      const selects = branches(
        input.link,
        (target, id, columns, targetMapping) => {
          const related = scope(target, id, depth + 1)
          const compiler = makeObjectQueryCompiler(
            sql,
            target,
            columns,
            related.filter,
            related.field
          )
          // Interface property aliases are resolved before compiling against a concrete implementer.
          const mapFilter = (value: QueryFilter): QueryFilter => {
            if ("field" in value) {
              validateSharedField(relation, value.field)
              return {
                ...value,
                field: targetMapping[value.field] ?? value.field,
              }
            }
            if ("and" in value) return { and: value.and.map(mapFilter) }
            if ("or" in value) return { or: value.or.map(mapFilter) }
            if ("not" in value) return { not: mapFilter(value.not) }
            return value
          }
          const predicate = hasFilter(nested)
            ? compiler.compileFilter(mapFilter(nested))
            : sql`true`
          return sql`${quantifier === "every" ? sql`not coalesce((${predicate}), false)` : predicate} as matches`
        }
      )
      const exists =
        selects.length === 0
          ? sql`false`
          : sql`exists(select 1 from (${sql.join(" union all ")(selects)}) related_matches where matches)`
      return quantifier === "some" ? exists : sql`not (${exists})`
    }
    return { field, filter }
  }
  return scope(root, rootId, 0)
}
