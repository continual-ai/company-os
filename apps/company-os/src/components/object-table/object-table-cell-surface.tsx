import { cn } from "@company/ui/lib/utils"
import { CheckIcon, CircleAlertIcon, LoaderCircleIcon } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"
import type { ReactNode } from "react"

import type { ObjectTableCellSaveStatus } from "./object-table-cell-state"
import { objectTableCellSelectionClassName } from "./object-table-cell-styles"

function ObjectTableCellSaveStatus({
  status,
}: {
  status: ObjectTableCellSaveStatus
}) {
  if (status === "idle") return null

  return (
    <output
      aria-live="polite"
      className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center bg-transparent"
    >
      {status === "saving" ? (
        <>
          <LoaderCircleIcon
            aria-hidden="true"
            className="size-3 animate-spin text-muted-foreground"
          />
          <span className="sr-only">Saving</span>
        </>
      ) : null}
      {status === "saved" ? (
        <>
          <CheckIcon aria-hidden="true" className="size-3 text-foreground" />
          <span className="sr-only">Saved</span>
        </>
      ) : null}
      {status === "error" ? (
        <>
          <CircleAlertIcon
            aria-hidden="true"
            className="size-3 text-destructive"
          />
          <span className="sr-only">Save failed</span>
        </>
      ) : null}
    </output>
  )
}

export function ObjectTableCellSurface({
  active,
  children,
  className,
  expandActive,
  status = "idle",
}: {
  active: boolean
  children: ReactNode
  className?: string | undefined
  expandActive: boolean
  status?: ObjectTableCellSaveStatus | undefined
}) {
  const surfaceRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const surface = surfaceRef.current
    if (!active || !expandActive || surface === null) return

    const scrollContainer = surface.closest<HTMLElement>(
      '[data-slot="table-container"]'
    )
    if (scrollContainer === null) return

    const surfaceBounds = surface.getBoundingClientRect()
    const containerBounds = scrollContainer.getBoundingClientRect()
    const visibleLeft = Math.max(containerBounds.left, 0)
    const visibleRight = Math.min(
      containerBounds.right,
      document.documentElement.clientWidth
    )
    const scrollDelta =
      surfaceBounds.right > visibleRight
        ? surfaceBounds.right - visibleRight
        : surfaceBounds.left < visibleLeft
          ? surfaceBounds.left - visibleLeft
          : 0

    if (Math.abs(scrollDelta) >= 1) scrollContainer.scrollLeft += scrollDelta
  }, [active, expandActive])

  return (
    <div
      ref={surfaceRef}
      className={cn(
        "relative flex min-w-0 items-center pl-2",
        active && expandActive
          ? "absolute top-0 left-0 z-30 box-border h-auto max-h-48 min-h-8 w-max max-w-[min(24rem,calc(100vw-2rem))] min-w-full items-start overflow-auto py-1 pr-2 shadow-sm"
          : "h-8 w-full overflow-hidden bg-transparent",
        active && expandActive && objectTableCellSelectionClassName,
        className
      )}
    >
      {children}
      <ObjectTableCellSaveStatus status={status} />
    </div>
  )
}

export function ObjectTableCellValidationMessage({
  children,
}: {
  children: string
}) {
  const messageRef = useRef<HTMLParagraphElement>(null)
  const offsetRef = useRef(0)
  const [horizontalOffset, setHorizontalOffset] = useState(0)

  useLayoutEffect(() => {
    const message = messageRef.current
    if (message === null) return undefined

    const scrollContainer = message.closest<HTMLElement>(
      '[data-slot="table-container"]'
    )
    if (scrollContainer === null) return undefined

    const updateOffset = () => {
      const messageBounds = message.getBoundingClientRect()
      const containerBounds = scrollContainer.getBoundingClientRect()
      const visibleLeft = Math.max(containerBounds.left, 0) + 8
      const visibleRight =
        Math.min(containerBounds.right, document.documentElement.clientWidth) -
        8
      const baseLeft = messageBounds.left - offsetRef.current
      const baseRight = messageBounds.right - offsetRef.current
      const nextOffset =
        baseRight > visibleRight
          ? visibleRight - baseRight
          : baseLeft < visibleLeft
            ? visibleLeft - baseLeft
            : 0

      offsetRef.current = nextOffset
      setHorizontalOffset(nextOffset)
    }

    updateOffset()
    const resizeObserver = new ResizeObserver(updateOffset)
    resizeObserver.observe(message)
    scrollContainer.addEventListener("scroll", updateOffset)
    window.addEventListener("resize", updateOffset)

    return () => {
      resizeObserver.disconnect()
      scrollContainer.removeEventListener("scroll", updateOffset)
      window.removeEventListener("resize", updateOffset)
    }
  }, [children])

  return (
    <p
      ref={messageRef}
      role="alert"
      className="absolute top-full left-0 z-50 w-max max-w-[min(18rem,calc(100vw-2rem))] min-w-full border border-destructive/30 bg-popover px-2 py-1 text-xs wrap-break-word whitespace-normal text-destructive shadow-sm"
      style={{ transform: `translateX(${horizontalOffset}px)` }}
    >
      {children}
    </p>
  )
}
