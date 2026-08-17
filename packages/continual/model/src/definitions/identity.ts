const definitionIdPattern = /^[a-z][A-Za-z0-9]*$/

export function definitionId(value: string): string {
  if (!definitionIdPattern.test(value)) {
    throw new Error(
      `Definition id '${value}' must be an immutable lower-camel identifier.`
    )
  }

  return value
}
