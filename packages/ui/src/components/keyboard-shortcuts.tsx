import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import {
  createShortcutRegistry,
  matchesShortcut,
  type KeyboardShortcut,
} from "#/lib/keyboard-shortcuts.ts"

const ShortcutContext = createContext<
  ReturnType<typeof createShortcutRegistry> | undefined
>(undefined)
const emptyShortcuts: ReadonlyArray<KeyboardShortcut> = []
const emptySnapshot = () => emptyShortcuts
const emptySubscribe = () => () => undefined

function hasOpenOverlay() {
  return [
    ...document.querySelectorAll(
      '[role="dialog"], [role="alertdialog"], [role="menu"], [data-slot="select-content"], [data-slot="popover-content"]'
    ),
  ].some(
    (element) =>
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden"
  )
}

export function KeyboardShortcutsProvider({
  children,
}: {
  children: ReactNode
}) {
  const [registry] = useState(createShortcutRegistry)
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const overlayOpen = hasOpenOverlay()
      const target = event.target instanceof Element ? event.target : null
      const editable = target?.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="combobox"]'
      )
      const directionalControl = target?.closest(
        '[role="tablist"], [role="slider"], [role="spinbutton"], [role="grid"], [role="tree"], [role="radiogroup"]'
      )
      const shortcut = registry
        .current()
        .find(
          (candidate) =>
            candidate.run &&
            (!overlayOpen || candidate.allowInOverlay) &&
            matchesShortcut(candidate, event) &&
            (!editable || candidate.allowInEditable) &&
            (!directionalControl ||
              !["ArrowLeft", "ArrowRight"].includes(event.key))
        )
      if (!shortcut) return
      event.preventDefault()
      shortcut.run?.()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [registry])
  return <ShortcutContext value={registry}>{children}</ShortcutContext>
}

/** Registrations follow component lifetime; handlers always reflect the latest render. */
export function useKeyboardShortcuts(
  shortcuts: ReadonlyArray<KeyboardShortcut>
) {
  const registry = useContext(ShortcutContext)
  const owner = useId()
  useEffect(() => {
    registry?.register(owner, shortcuts)
  }, [registry, owner, shortcuts])
  useEffect(() => () => registry?.unregister(owner), [registry, owner])
}

export function useAvailableShortcuts() {
  const registry = useContext(ShortcutContext)
  return useSyncExternalStore(
    registry?.subscribe ?? emptySubscribe,
    registry?.snapshot ?? emptySnapshot,
    emptySnapshot
  )
}
