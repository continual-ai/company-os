import { expect, it } from "vitest"

import {
  createShortcutRegistry,
  matchesShortcut,
  type KeyboardShortcut,
} from "#/lib/keyboard-shortcuts.ts"

const shortcut: KeyboardShortcut = {
  id: "next",
  key: "ArrowRight",
  group: "Records",
  description: "Next record",
}
const event = {
  key: "ArrowRight",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
}

it("respects modifiers, composition, repeats, and already handled keys", () => {
  expect(matchesShortcut(shortcut, event)).toBe(true)
  for (const flag of [
    "metaKey",
    "ctrlKey",
    "altKey",
    "shiftKey",
    "repeat",
    "isComposing",
    "defaultPrevented",
  ] as const)
    expect(matchesShortcut(shortcut, { ...event, [flag]: true })).toBe(false)
  expect(matchesShortcut({ ...shortcut, enabled: false }, event)).toBe(false)
  expect(
    matchesShortcut(
      { ...shortcut, key: "?" },
      { ...event, key: "?", shiftKey: true }
    )
  ).toBe(true)
  expect(
    matchesShortcut(
      { ...shortcut, key: "k", mod: true },
      { ...event, key: "k", metaKey: true }
    )
  ).toBe(true)
  expect(
    matchesShortcut(
      { ...shortcut, key: "k", mod: true },
      { ...event, key: "k", ctrlKey: true }
    )
  ).toBe(true)
  expect(
    matchesShortcut(
      { ...shortcut, key: "k", mod: true },
      { ...event, key: "k" }
    )
  ).toBe(false)
})

it("updates handlers without churning the help snapshot and removes page shortcuts on unmount", () => {
  const registry = createShortcutRegistry()
  let calls = 0
  let notifications = 0
  const unsubscribe = registry.subscribe(() => {
    notifications++
  })
  registry.register("page", [
    {
      ...shortcut,
      run: () => {
        calls += 1
      },
    },
  ])
  const snapshot = registry.snapshot()
  registry.register("page", [
    {
      ...shortcut,
      run: () => {
        calls += 10
      },
    },
  ])
  expect(registry.snapshot()).toBe(snapshot)
  registry.current()[0]?.run?.()
  expect(calls).toBe(10)
  expect(notifications).toBe(1)
  registry.register("page", [{ ...shortcut, enabled: false }])
  expect(registry.snapshot()[0]?.enabled).toBe(false)
  registry.unregister("page")
  expect(registry.current()).toEqual([])
  expect(registry.snapshot()).toEqual([])
  unsubscribe()
})
