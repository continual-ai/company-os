import { useQueries } from "@tanstack/react-query"
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

import { clientFor } from "#/ui/model/object-client.ts"
import { useModelRuntime } from "#/ui/model/runtime-context.tsx"

type Visit = { readonly objectType: string; readonly id: string }
const RecentContext = createContext<
  | {
      readonly entries: ReadonlyArray<Visit>
      readonly visit: (entry: Visit) => void
    }
  | undefined
>(undefined)

/** The authenticated app shell owns navigation history; preloads and background reads are not visits. */
export function RecentRecordsProvider({
  children,
}: {
  readonly children: ReactNode
}) {
  const [entries, setEntries] = useState<ReadonlyArray<Visit>>([])
  const [visit] = useState(
    () => (entry: Visit) =>
      setEntries((previous) =>
        [
          entry,
          ...previous.filter(
            (item) =>
              item.id !== entry.id || item.objectType !== entry.objectType
          ),
        ].slice(0, 6)
      )
  )
  return (
    <RecentContext.Provider value={{ entries, visit }}>
      {children}
    </RecentContext.Provider>
  )
}

export function useRecordVisit(objectType: string, id: string) {
  const context = useContext(RecentContext)
  const visit = context?.visit
  useEffect(() => {
    visit?.({ objectType, id })
  }, [visit, objectType, id])
}

/** Only explicitly visited records are revalidated with the current identity. */
export function useRecentRecords() {
  const runtime = useModelRuntime()
  const context = useContext(RecentContext)
  const entries = (context?.entries ?? []).flatMap((entry) => {
    const object = Object.values(runtime.model.objects).find(
      (item) => item.id === entry.objectType
    )
    return object ? [{ object, id: entry.id }] : []
  })
  const results = useQueries({
    queries: entries.map(({ object, id }) =>
      clientFor(runtime, object).get({ id })
    ),
  })
  return entries.flatMap(({ object }, index) => {
    const record = results[index]?.data
    return record && !results[index]?.isError ? [{ object, record }] : []
  })
}
