import { expect, it, vi } from "vitest"

import {
  createLocalPreferences,
  parseLocalPreference,
} from "#/lib/local-preferences.ts"

const isRatio = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value > 0 &&
  value < 100

it("falls back for malformed, outdated, or out-of-range stored values", () => {
  for (const raw of [null, "{", '"60"', "null", "{}", "-10", "101"])
    expect(parseLocalPreference(raw, 50, isRatio)).toBe(50)
  expect(parseLocalPreference("60", 50, isRatio)).toBe(60)
})

it("isolates users, restores values, and saves a reset as the default", () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
  const alice = createLocalPreferences("app:alice", () => storage)
  const bob = createLocalPreferences("app:bob", () => storage)
  alice.write("record-split", 60)
  expect(bob.read("record-split")).toBeNull()
  expect(
    createLocalPreferences("app:alice", () => storage).read("record-split")
  ).toBe("60")
  alice.write("record-split", 50)
  expect(storage.getItem("app:alice:record-split")).toBe("50")
})

it("keeps session preferences usable when browser storage is blocked", () => {
  const store = createLocalPreferences("app:alice", () => {
    throw new Error("Blocked")
  })
  expect(store.read("sidebar-width")).toBeNull()
  store.write("sidebar-width", 300)
  expect(store.read("sidebar-width")).toBe("300")
})

it("notifies subscribers for local writes and relevant cross-tab changes only", () => {
  const store = createLocalPreferences("app:alice", () => undefined)
  const listener = vi.fn()
  const unsubscribe = store.subscribe(listener)
  store.write("sidebar-width", 300)
  expect(listener).toHaveBeenCalledTimes(1)
  store.storageChanged("app:bob:sidebar-width")
  expect(listener).toHaveBeenCalledTimes(1)
  store.storageChanged("app:alice:sidebar-width")
  expect(listener).toHaveBeenCalledTimes(2)
  expect(store.read("sidebar-width")).toBeNull()
  store.storageChanged(null)
  expect(listener).toHaveBeenCalledTimes(3)
  unsubscribe()
  store.write("sidebar-width", 280)
  expect(listener).toHaveBeenCalledTimes(3)
})
