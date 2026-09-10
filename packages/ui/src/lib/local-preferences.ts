type PreferenceStorage = Pick<Storage, "getItem" | "setItem">

/** Stores presentation preferences only; never credentials or authoritative business data. */
export function createLocalPreferences(
  scope: string,
  storage: () => PreferenceStorage | undefined
) {
  const prefix = `${scope}:`
  const fallback = new Map<string, string>()
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) listener()
  }
  return {
    read(name: string): string | null {
      const key = prefix + name
      if (fallback.has(key)) return fallback.get(key) ?? null
      try {
        return storage()?.getItem(key) ?? null
      } catch {
        return null
      }
    },
    write(name: string, value: unknown) {
      const key = prefix + name
      const serialized = JSON.stringify(value)
      try {
        const target = storage()
        if (!target) throw new Error("Local storage unavailable")
        target.setItem(key, serialized)
        fallback.delete(key)
      } catch {
        fallback.set(key, serialized)
      }
      notify()
    },
    subscribe(this: void, listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    storageChanged(key: string | null) {
      if (key !== null && !key.startsWith(prefix)) return
      if (key === null) fallback.clear()
      else fallback.delete(key)
      notify()
    },
  }
}

export function parseLocalPreference<T>(
  raw: string | null,
  defaultValue: T,
  validate: (value: unknown) => value is T
): T {
  if (raw === null) return defaultValue
  try {
    const value: unknown = JSON.parse(raw)
    return validate(value) ? value : defaultValue
  } catch {
    return defaultValue
  }
}
