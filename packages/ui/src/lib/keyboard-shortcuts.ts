export interface KeyboardShortcut {
  readonly id: string
  readonly key: string
  readonly label?: string
  readonly description: string
  readonly group: string
  readonly mod?: boolean
  readonly enabled?: boolean
  readonly allowInEditable?: boolean
  readonly allowInOverlay?: boolean
  readonly run?: () => void
}

export function matchesShortcut(
  shortcut: KeyboardShortcut,
  event: Pick<
    KeyboardEvent,
    | "key"
    | "metaKey"
    | "ctrlKey"
    | "altKey"
    | "shiftKey"
    | "repeat"
    | "isComposing"
    | "defaultPrevented"
  >
) {
  if (
    shortcut.enabled === false ||
    event.repeat ||
    event.isComposing ||
    event.defaultPrevented ||
    event.altKey
  )
    return false
  if (Boolean(shortcut.mod) !== (event.metaKey || event.ctrlKey)) return false
  if (event.shiftKey && event.key !== "?") return false
  return event.key.toLowerCase() === shortcut.key.toLowerCase()
}

/** Handler changes do not invalidate the help snapshot or trigger registration loops. */
export function createShortcutRegistry() {
  const entries = new Map<string, ReadonlyArray<KeyboardShortcut>>()
  const listeners = new Set<() => void>()
  let snapshot: ReadonlyArray<KeyboardShortcut> = []
  let signature = "[]"
  const current = () => [
    ...new Map(
      [...entries.values()].flat().map((shortcut) => [shortcut.id, shortcut])
    ).values(),
  ]
  const publish = () => {
    const next = current()
    const nextSignature = JSON.stringify(next)
    if (nextSignature === signature) return
    signature = nextSignature
    snapshot = next
    for (const listener of listeners) listener()
  }
  return {
    register: (owner: string, shortcuts: ReadonlyArray<KeyboardShortcut>) => {
      entries.set(owner, shortcuts)
      publish()
    },
    unregister: (owner: string) => {
      entries.delete(owner)
      publish()
    },
    current,
    snapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
