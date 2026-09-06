import { Context, Effect } from "effect"
import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"

/** Connects derived UI queries to their actual cached-query dependencies. */
const QueryContext = Context.Reference<Atom.AtomContext | undefined>(
  "@model/QueryContext",
  { defaultValue: () => undefined }
)

export function observeQuery<A, E>(effect: Effect.Effect<A, E>) {
  return Atom.make((get) =>
    effect.pipe(Effect.provideService(QueryContext, get))
  )
}

/** One request-result cache per browser session or server request. */
export function createModelDataClient() {
  const registry = AtomRegistry.make()
  const entries = new Map<
    string,
    {
      scope: string
      atom: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>
    }
  >()
  const keys = new WeakMap<object, string>()
  registry.onNodeRemoved = (node) => {
    const key = keys.get(node.atom)
    if (key !== undefined && entries.get(key)?.atom === node.atom)
      entries.delete(key)
  }
  let identity: string | undefined

  const invalidate = (scopes: ReadonlyArray<string>) => {
    const changed = new Set(scopes)
    const all =
      changed.has("*") ||
      [
        "role",
        "roleAssignment",
        "groupMembership",
        "user",
        "serviceAccount",
      ].some((type) => changed.has(type))
    for (const entry of entries.values()) {
      if (all || changed.has(entry.scope)) {
        registry.refresh(entry.atom)
      }
    }
  }

  const query = <A, E>(
    scope: string,
    operation: string,
    input: unknown,
    effect: Effect.Effect<A, E>
  ): Effect.Effect<A, E> =>
    Effect.suspend(() => {
      const key = JSON.stringify([scope, operation, input])
      let entry = entries.get(key)
      if (entry === undefined) {
        entry = {
          scope,
          atom: Atom.make(effect).pipe(Atom.setIdleTTL("30 seconds")),
        }
        entries.set(key, entry)
        keys.set(entry.atom, key)
      }
      // SAFETY: this key identifies the same model operation and decoded result.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const atom = entry.atom as Atom.Atom<AsyncResult.AsyncResult<A, E>>
      return Effect.gen(function* () {
        const context = yield* QueryContext
        if (context !== undefined)
          return yield* context.result(atom, { suspendOnWaiting: true })
        if (AsyncResult.isFailure(registry.get(atom))) registry.refresh(atom)
        return yield* AtomRegistry.getResult(registry, atom, {
          suspendOnWaiting: true,
        })
      })
    })
  const read = <A, E>(
    scope: string,
    operation: string,
    input: unknown,
    effect: Effect.Effect<A, E>
  ) => Effect.runPromise(query(scope, operation, input, effect))

  const reset = () => {
    entries.clear()
    registry.reset()
  }

  return {
    reset,
    query,
    setIdentity: (id: string) => {
      if (identity !== undefined && identity !== id) {
        entries.clear()
        registry.reset()
      }
      identity = id
    },
    read,
    invalidate,
    registry,
    dispose: () => {
      entries.clear()
      registry.dispose()
    },
  }
}

let browserClient: ReturnType<typeof createModelDataClient> | undefined

/** Server callers must create their own scope; no authenticated data is cached globally on the server. */
export function modelData() {
  if (typeof window === "undefined")
    throw new Error("Model data needs a browser or an explicit request scope.")
  if (browserClient === undefined) {
    browserClient = createModelDataClient()
    window.addEventListener("focus", () => browserClient?.invalidate(["*"]))
  }
  return browserClient
}
