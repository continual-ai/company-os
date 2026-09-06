import { Cause, type Effect } from "effect"
import { AsyncResult } from "effect/unstable/reactivity"
import { useMemo, useSyncExternalStore } from "react"

import { modelData, observeQuery } from "./data-client"

const initial = AsyncResult.initial()

/** React observes the existing query graph; no records or request state are copied into hooks. */
export function useModelQuery<A, E>(effect: Effect.Effect<A, E>) {
  const store = useMemo(() => {
    const atom = observeQuery(effect)
    return {
      subscribe: (notify: () => void) =>
        modelData().registry.subscribe(atom, notify),
      getSnapshot: () => modelData().registry.get(atom),
      getServerSnapshot: (): AsyncResult.AsyncResult<A, E> => initial,
    }
  }, [effect])
  const result = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )
  return {
    value: AsyncResult.isSuccess(result) ? result.value : undefined,
    loading: result.waiting || result._tag === "Initial",
    error: AsyncResult.isFailure(result)
      ? Cause.squash(result.cause)
      : undefined,
  }
}
