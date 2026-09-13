import { type ModelCatalog, modelTypeAccepts } from "#/runtime/model/index.ts"
import { linkStorage } from "#/runtime/server/storage/link-storage.ts"
import {
  quoteIdentifier as q,
  quoteLiteral as literal,
  snakeCase,
} from "#/runtime/server/storage/table.ts"

/** Deferred checks see the final graph, including atomic create, replace, and delete operations. */
export function linkConstraintDdl(
  model: ModelCatalog,
  tableFor: (type: string) => string
): string[] {
  const ddl: string[] = []
  for (const link of Object.values(model.links)) {
    const table = q(`link_${snakeCase(link.id)}`)
    const plan = linkStorage(link)
    const physicalTable =
      plan.kind === "join" ? table : q(tableFor(plan.ownerType))
    const edgeValue = (row: "OLD" | "NEW", side: "forward" | "reverse") =>
      plan.kind === "join"
        ? `${row}.${side}_id`
        : `${row}.${side === plan.side ? "id" : q(plan.column)}`
    // A single FK and its UNIQUE constraint already enforce max: 1.
    const sides = (["forward", "reverse"] as const).filter((side) => {
      const end = link[side]
      return end.min > 0 || (end.max !== undefined && end.max !== 1)
    })
    if (sides.length === 0) continue
    const changed =
      plan.kind === "foreignKey"
        ? `OLD.${q(plan.column)} is distinct from NEW.${q(plan.column)}`
        : `(OLD.forward_id, OLD.reverse_id) is distinct from (NEW.forward_id, NEW.reverse_id)`
    const triggers = (name: string, deferred: boolean) => {
      const prefix = deferred ? "create constraint trigger" : "create trigger"
      const timing = deferred ? "after" : "before"
      const constraint = deferred ? " deferrable initially deferred" : ""
      return [
        `${prefix} ${q(name)} ${timing} insert or delete on ${physicalTable}${constraint} for each row execute function ${q(name)}()`,
        `${prefix} ${q(`${name}_update`)} ${timing} update on ${physicalTable}${constraint} for each row when (${changed}) execute function ${q(name)}()`,
      ]
    }
    const validate = q(`check_${snakeCase(link.id)}`)
    const trigger = q(`validate_${snakeCase(link.id)}`)
    const checks = sides
      .map((side) => {
        const end = link[side]
        const column = q(`${side}_id`)
        const target = q(tableFor(end.from.typeId))
        const maximum =
          end.max === undefined || end.max === 1 ? "false" : `n > ${end.max}`
        return `if side = ${literal(side)} and exists (select 1 from ${target} where id = source_id) then
    select count(*) into n from ${table} where ${column} = source_id;
    if n < ${end.min} or ${maximum} then
      raise exception 'Link % traversal % requires %..% targets; found %', ${literal(link.id)}, ${literal(end.key)}, ${end.min}, ${literal(end.max === undefined ? "unbounded" : String(end.max))}, n
        using errcode = '23514', constraint = ${literal(`${link.id}.${end.key}.bounds`)};
    end if;
  end if;`
      })
      .join("\n  ")
    ddl.push(`create function ${validate}(source_id text, side text) returns void language plpgsql as $$
declare n bigint;
begin
  ${checks}
end $$`)
    ddl.push(`create function ${trigger}() returns trigger language plpgsql as $$
begin
  if TG_OP <> 'INSERT' then
    ${sides.map((side) => `perform ${validate}(${edgeValue("OLD", side)}, ${literal(side)});`).join("\n    ")}
  end if;
  if TG_OP <> 'DELETE' then
    ${sides.map((side) => `perform ${validate}(${edgeValue("NEW", side)}, ${literal(side)});`).join("\n    ")}
  end if;
  return null;
end $$`)
    ddl.push(...triggers(`validate_${snakeCase(link.id)}`, true))
    // Lock only the endpoints whose cardinality can change, including direct SQL writes.
    const lock = q(`lock_${snakeCase(link.id)}`)
    ddl.push(`create function ${lock}() returns trigger language plpgsql as $$
    declare ids text[] := array[]::text[];
    begin
      if TG_OP <> 'INSERT' then ids := ids || array[${sides.map((side) => edgeValue("OLD", side)).join(", ")}]; end if;
      if TG_OP <> 'DELETE' then ids := ids || array[${sides.map((side) => edgeValue("NEW", side)).join(", ")}]; end if;
      perform id from objects where id = any(ids) order by id for update;
      if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
    end $$`)
    ddl.push(...triggers(`lock_${snakeCase(link.id)}`, false))
    for (const side of ["forward", "reverse"] as const) {
      const end = link[side]
      if (end.min === 0) continue
      const fn = q(`require_${snakeCase(link.id)}_${side}`)
      ddl.push(`create function ${fn}() returns trigger language plpgsql as $$
begin
  perform ${validate}(NEW.id, ${literal(side)});
  return null;
end $$`)
      ddl.push(
        `create constraint trigger ${fn} after insert on ${q(tableFor(end.from.typeId))} deferrable initially deferred for each row execute function ${fn}()`
      )
    }
  }
  // A compound unique rule can include singular traversals as well as stored fields.
  for (const object of Object.values(model.objects)) {
    for (const [rule, keys] of Object.entries(object.uniqueBy)) {
      if (keys.every((key) => object.properties[key] !== undefined)) continue
      const ends = keys.map((key) =>
        Object.values(model.links)
          .flatMap((link) =>
            (["forward", "reverse"] as const).map((side) => ({
              link,
              side,
              end: link[side],
            }))
          )
          .find(
            ({ end }) =>
              end.key === key &&
              modelTypeAccepts(model, object.id, end.from.typeId)
          )
      )
      const nativeColumns = keys.map((key, i) => {
        const item = ends[i]
        if (!item) return snakeCase(key)
        const plan = linkStorage(item.link)
        return plan.kind === "foreignKey" &&
          plan.ownerType === object.id &&
          plan.side === item.side
          ? plan.column
          : undefined
      })
      if (nativeColumns.every((column) => column !== undefined)) {
        ddl.push(
          `alter table ${q(tableFor(object.id))} add constraint ${q(`${snakeCase(object.collection)}_${snakeCase(rule)}_unique`)} unique (${nativeColumns.map(q).join(", ")}) deferrable initially deferred`
        )
        continue
      }
      const joins = ends.flatMap((item, i) =>
        item
          ? [
              `join ${q(`link_${snakeCase(item.link.id)}`)} e${i} on e${i}.${q(`${item.side}_id`)} = o.id`,
            ]
          : []
      )
      const columns = keys.map((key, i) =>
        ends[i]
          ? `e${i}.${q(ends[i].side === "forward" ? "reverse_id" : "forward_id")}`
          : `o.${q(snakeCase(key))}`
      )
      const fn = q(`unique_${snakeCase(object.id)}_${snakeCase(rule)}`)
      ddl.push(`create function ${fn}() returns trigger language plpgsql as $$
begin
  if exists (select 1 from ${q(tableFor(object.id))} o ${joins.join(" ")} where ${columns.map((column) => `${column} is not null`).join(" and ")} group by ${columns.join(", ")} having count(*) > 1) then
    raise exception 'Unique relationship rule % violated', ${literal(`${object.id}.${rule}`)} using errcode = '23505', constraint = ${literal(`${snakeCase(object.collection)}_${snakeCase(rule)}_unique`)};
  end if;
  return null;
end $$`)
      const lock = q(`lock_unique_${snakeCase(object.id)}_${snakeCase(rule)}`)
      ddl.push(
        `create function ${lock}() returns trigger language plpgsql as $$ begin perform pg_advisory_xact_lock(hashtextextended(${literal(`unique:${object.id}:${rule}`)}, 0)); return null; end $$`
      )
      for (const table of new Set([
        tableFor(object.id),
        ...ends.flatMap((item) => {
          if (!item) return []
          const plan = linkStorage(item.link)
          return [
            plan.kind === "join"
              ? `link_${snakeCase(item.link.id)}`
              : tableFor(plan.ownerType),
          ]
        }),
      ])) {
        ddl.push(
          `create trigger ${lock} before insert or update or delete on ${q(table)} for each statement execute function ${lock}()`
        )
        ddl.push(
          `create constraint trigger ${fn} after insert or update or delete on ${q(table)} deferrable initially deferred for each row execute function ${fn}()`
        )
      }
    }
  }
  return ddl
}
