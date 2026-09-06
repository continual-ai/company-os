import {
  RecordId,
  type RecordAlias,
  type ObjectRef,
  type ModelCatalog,
  type ModelObjectRef,
} from "@company/runtime"
import { RecordAliasNotFound } from "@company/runtime/effect/object-repository"
import { eq, inArray, type AnyRelations } from "drizzle-orm"
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors"
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres"
import { Effect } from "effect"

import type { PostgresStorage } from "./schema"

export type PostgresRecordAliasResolutionError =
  | EffectDrizzleQueryError
  | RecordAliasNotFound

function makeObjectRef<const TObjectType extends string>(
  objectType: TObjectType,
  id: string
): ObjectRef<TObjectType> {
  const dynamicObjectType: string = objectType
  const reference = { id: RecordId(dynamicObjectType)(id), objectType }
  // SAFETY: ObjectRef distributes over object-type unions; this helper keeps
  // the validated branded ID paired with its object-type discriminator.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return reference as ObjectRef<TObjectType>
}

/** Resolves globally unique aliases in input order without requiring object types. */
export function resolveRecordAliases<
  const TModel extends ModelCatalog,
  const TRelations extends AnyRelations,
>(
  storage: PostgresStorage<TModel>,
  db: EffectPgDatabase<TRelations>,
  aliases: ReadonlyArray<RecordAlias>
): Effect.Effect<
  ReadonlyArray<ModelObjectRef<TModel>>,
  PostgresRecordAliasResolutionError
> {
  if (aliases.length === 0) return Effect.succeed([])
  const { recordAliases, objects } = storage.core
  return Effect.gen(function* () {
    const rows = yield* db
      .select({
        alias: recordAliases.alias,
        id: objects.id,
        objectType: objects.objectType,
      })
      .from(recordAliases)
      .innerJoin(objects, eq(recordAliases.objectId, objects.id))
      .where(inArray(recordAliases.alias, [...new Set(aliases)]))
    const byAlias = new Map(rows.map((row) => [row.alias, row]))
    const references: Array<ModelObjectRef<TModel>> = []
    for (const alias of aliases) {
      const resolved = byAlias.get(alias)
      if (resolved === undefined) {
        return yield* Effect.fail(new RecordAliasNotFound({ alias }))
      }
      if (resolved.objectType === storage.model.root.id) {
        return yield* Effect.die(
          `Model root '${resolved.id}' cannot own a record alias.`
        )
      }
      if (!Object.hasOwn(storage.model.objects, resolved.objectType)) {
        return yield* Effect.die(
          `Alias '${alias}' resolved to unknown object type '${resolved.objectType}'.`
        )
      }
      references.push(makeObjectRef(resolved.objectType, resolved.id))
    }
    return references
  })
}
