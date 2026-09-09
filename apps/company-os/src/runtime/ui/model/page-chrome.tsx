import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type { RecordNavigation } from "#/runtime/ui/model/record-navigation.tsx"

interface PageChrome {
  readonly collectionHref?: string | undefined
  readonly collectionLabel?: string | undefined
  readonly recordNavigation?: RecordNavigation | undefined
}

interface PageChromeContextValue {
  readonly current: PageChrome
  readonly setCurrent: (chrome: PageChrome) => void
}

const PageChromeContext = createContext<PageChromeContextValue | undefined>(
  undefined
)

export function PageChromeProvider({
  children,
}: {
  readonly children: ReactNode
}) {
  const [current, setCurrent] = useState<PageChrome>({})
  const value = useMemo(() => ({ current, setCurrent }), [current])

  return (
    <PageChromeContext.Provider value={value}>
      {children}
    </PageChromeContext.Provider>
  )
}

export function usePageChrome(): PageChrome {
  const context = useContext(PageChromeContext)
  if (context === undefined) {
    throw new Error("usePageChrome must be used within PageChromeProvider.")
  }
  return context.current
}

export function usePageChromeOverride(chrome: PageChrome): void {
  const context = useContext(PageChromeContext)
  if (context === undefined) {
    throw new Error(
      "usePageChromeOverride must be used within PageChromeProvider."
    )
  }
  const { collectionHref, collectionLabel, recordNavigation } = chrome
  const { setCurrent } = context

  useEffect(() => {
    setCurrent({ collectionHref, collectionLabel, recordNavigation })
    return () => setCurrent({})
  }, [collectionHref, collectionLabel, recordNavigation, setCurrent])
}
