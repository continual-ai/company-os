import type { LinkType } from "#/runtime/model/index.ts"
import { linkStorage } from "#/runtime/server/storage/link-storage.ts"
import {
  quoteIdentifier as q,
  quoteLiteral as literal,
  snakeCase,
} from "#/runtime/server/storage/table.ts"

export const acyclicConstraintName = (link: LinkType) =>
  `${snakeCase(link.id)}_acyclic`

/** Validate the final graph for both native references and association tables. */
export function acyclicLinkDdl(
  link: LinkType,
  objectTable: string,
  linkTable: string
): string[] {
  const storage = linkStorage(link)
  const name = acyclicConstraintName(link)
  const source =
    storage.kind === "join"
      ? 'new."forward_id"'
      : storage.side === "forward"
        ? 'new."id"'
        : `new.${q(storage.column)}`
  const target =
    storage.kind === "join"
      ? 'new."reverse_id"'
      : storage.side === "reverse"
        ? 'new."id"'
        : `new.${q(storage.column)}`
  const table = storage.kind === "join" ? linkTable : objectTable
  const update =
    storage.kind === "join" ? '"forward_id", "reverse_id"' : q(storage.column)
  return [
    `create function ${q(name)}() returns trigger language plpgsql as $$
begin
  -- Removed edges and empty references cannot introduce a cycle.
  if not exists (select 1 from ${q(linkTable)} where forward_id = ${source} and reverse_id = ${target}) then
    return null;
  end if;
  -- A write serializes graph validation and rejects stale repeatable-read snapshots.
  -- Endpoint row locks alone cannot protect cycles formed by disjoint new edges.
  insert into "link_graph_guards" ("link_id", "revision") values (${literal(link.id)}, 1)
    on conflict ("link_id") do update set "revision" = "link_graph_guards"."revision" + 1;
  if exists (
      with recursive reachable(id) as (
        select ${target}
        union
        select edge.reverse_id from ${q(linkTable)} edge join reachable on edge.forward_id = reachable.id
      )
      select 1 from reachable where id = ${source}
    ) then
    raise exception using errcode = '23514', constraint = ${literal(name)}, message = 'Link cannot contain a cycle.';
  end if;
  return null;
end
$$`,
    `create constraint trigger ${q(name)} after insert or update of ${update} on ${q(table)} deferrable initially deferred for each row execute function ${q(name)}()`,
  ]
}
