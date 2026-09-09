const definitionIdPattern = /^[a-z][A-Za-z0-9]*$/

export function definitionId<const TValue extends string>(
  value: TValue
): TValue {
  if (!definitionIdPattern.test(value)) {
    throw new Error(
      `Definition id '${value}' must be an immutable lower-camel identifier.`
    )
  }

  return value
}

/**
 * Rejects members of an inferred definition that its contract does not declare.
 * A `define*` function infers its whole argument as one literal type, which
 * would otherwise let misspelled or unknown keys through unchecked.
 */
export type NoExtraKeys<TDefinition, TContract> = {
  readonly [TKey in Exclude<keyof TDefinition, keyof TContract>]: never
}

/**
 * `TDerived` for one literal definition and `TOpen` for the open definition
 * type itself, so a bare `ObjectType`, `InterfaceType`, or `ModuleDefinition`
 * stays the supertype of every defined value. The definition is deliberately
 * in the check position: TypeScript then measures the type parameter as
 * covariant, whereas `string extends D["id"]` would make it invariant.
 */
export type OpenOr<
  D extends { readonly id: string },
  TOpen,
  TDerived,
> = D extends { readonly id: infer TId extends string }
  ? string extends TId
    ? TOpen
    : TDerived
  : never
