/** Module relationships come from installed source; activation is persisted separately. */
export interface ModuleAvailability {
  readonly id: string
  readonly enabled: boolean
  readonly required: boolean
  readonly dependencies: ReadonlyArray<string>
}

/** Preview the same dependency closure that the server applies atomically. */
export function moduleActivationPlan<M extends ModuleAvailability>(
  modules: ReadonlyArray<M>,
  moduleId: string,
  enabled: boolean
) {
  const affected = new Set<string>()
  const visit = (id: string) => {
    if (affected.has(id)) return
    affected.add(id)
    const related = enabled
      ? (modules.find((module) => module.id === id)?.dependencies ?? [])
      : modules
          .filter(
            (module) => module.enabled && module.dependencies.includes(id)
          )
          .map((module) => module.id)
    for (const dependency of related) visit(dependency)
  }
  visit(moduleId)
  return modules.filter(
    (module) => affected.has(module.id) && module.enabled !== enabled
  )
}
