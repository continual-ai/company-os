import { useLocalPreference } from "@company/ui/local-preferences"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@company/ui/resizable"
import { type ReactNode, useEffect, useRef, useState } from "react"

function isSplitRatio(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value < 100
  )
}

export function ObjectRecordLayout({
  sidebar,
  children,
}: {
  readonly sidebar: ReactNode
  readonly children: ReactNode
}) {
  const [split, saveSplit] = useLocalPreference(
    "record-main-split",
    65,
    isSplitRatio
  )
  const container = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(false)

  useEffect(() => {
    const element = container.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWide(entry.contentRect.width >= 768)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={container} className="flex min-h-0 flex-1 flex-col">
      {sidebar && wide ? (
        <ResizablePanelGroup
          orientation="horizontal"
          defaultLayout={{ content: split, related: 100 - split }}
          onLayoutChanged={(layout, { isUserInteraction }) => {
            if (isUserInteraction && layout.content !== undefined)
              saveSplit(layout.content)
          }}
        >
          <ResizablePanel id="content" defaultSize="65%" minSize={320}>
            <div className="flex h-full min-h-0 flex-col">{children}</div>
          </ResizablePanel>
          <ResizableHandle
            aria-label="Resize related records"
            onDoubleClick={() => saveSplit(65)}
          />
          <ResizablePanel id="related" defaultSize="35%" minSize={288}>
            <div className="flex h-full min-h-0 flex-col">{sidebar}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div
            className={
              sidebar
                ? "flex shrink-0 flex-col"
                : "flex min-h-0 flex-1 flex-col"
            }
          >
            {children}
          </div>
          {sidebar && (
            <div className="flex shrink-0 flex-col border-t">{sidebar}</div>
          )}
        </div>
      )}
    </div>
  )
}
