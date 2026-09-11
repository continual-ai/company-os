import type { ModelCatalog } from "#/runtime/model/index.ts"
import { modelTypeAccepts } from "#/runtime/model/index.ts"
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
    const validate = q(`check_${snakeCase(link.id)}`)
    const trigger = q(`validate_${snakeCase(link.id)}`)
    const checks = (["forward", "reverse"] as const)
      .map((side) => {
        const end = link[side]
        const column = q(`${side}_id`)
        const target = q(tableFor(end.from.typeId))
        const maximum = end.max === undefined ? "false" : `n > ${end.max}`
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
    perform ${validate}(OLD.forward_id, 'forward');
    perform ${validate}(OLD.reverse_id, 'reverse');
  end if;
  if TG_OP <> 'DELETE' then
    perform ${validate}(NEW.forward_id, 'forward');
    perform ${validate}(NEW.reverse_id, 'reverse');
  end if;
  return null;
end $$`)
    ddl.push(
      `create constraint trigger ${trigger} after insert or update or delete on ${table} deferrable initially deferred for each row execute function ${trigger}()`
    )
    // Edge changes on the same relationship serialize before SQL executes, preventing count races.
    const lock = q(`lock_${snakeCase(link.id)}`)
    ddl.push(`create function ${lock}() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(${literal(`link:${link.id}`)}, 0));
  return null;
end $$`)
    ddl.push(
      `create trigger ${lock} before insert or update or delete on ${table} for each statement execute function ${lock}()`
    )
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
        ...ends.flatMap((item) =>
          item ? [`link_${snakeCase(item.link.id)}`] : []
        ),
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
