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
