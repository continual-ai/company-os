import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react"

import {
  createLocalPreferences,
  parseLocalPreference,
} from "#/lib/local-preferences.ts"

const Context = createContext<ReturnType<typeof createLocalPreferences> | null>(
  null
)
const serverSnapshot = () => null
const noSubscription = () => () => undefined

/** The application supplies a namespace including its signed-in user ID. */
export function LocalPreferencesProvider({
  scope,
  children,
}: {
  readonly scope: string
  readonly children: ReactNode
}) {
  const store = useMemo(
    () => createLocalPreferences(scope, () => window.localStorage),
    [scope]
  )
  useEffect(() => {
    const changed = (event: StorageEvent) => store.storageChanged(event.key)
    window.addEventListener("storage", changed)
    return () => window.removeEventListener("storage", changed)
  }, [store])
  return <Context value={store}>{children}</Context>
}

/** Undefined keys opt out; values must be JSON-serializable and pass validation. */
export function useLocalPreference<T>(
  key: string | undefined,
  defaultValue: T,
  validate: (value: unknown) => value is T
) {
  const store = useContext(Context)
  const snapshot = useCallback(
    () => (key === undefined ? null : (store?.read(key) ?? null)),
    [key, store]
  )
  const raw = useSyncExternalStore(
    store?.subscribe ?? noSubscription,
    snapshot,
    serverSnapshot
  )
  const value = useMemo(
    () => parseLocalPreference(raw, defaultValue, validate),
    [raw, defaultValue, validate]
  )
  const save = useCallback(
    (next: T) => {
      if (key === undefined || !store || !validate(next)) return false
      store.write(key, next)
      return true
    },
    [key, store, validate]
  )
  return [value, save] as const
}
