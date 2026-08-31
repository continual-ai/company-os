"use client"

import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { Button } from "@company/ui/components/button"
import { cn } from "@company/ui/lib/utils"
import { ArrowDownIcon } from "lucide-react"
import * as React from "react"

// Scroll anchoring engine ported from the @shadcn/react message-scroller
// primitive. A hidden spacer after the last item lets a new anchor item pin
// to the viewport top before enough content exists below it, and the mode
// state machine decides whether user scrolling, streaming growth, or content
// prepends control the scroll position.

type ScrollMode =
  | "following-bottom"
  | "free-scrolling"
  | "anchored-to-message"
  | "settling-jump"

type MessageScrollerDefaultScrollPosition = "start" | "end" | "last-anchor"
type MessageScrollerButtonDirection = "start" | "end"
type MessageScrollerScrollAlign = "start" | "center" | "end" | "nearest"

interface MessageScrollerScrollOptions {
  align?: MessageScrollerScrollAlign
  behavior?: ScrollBehavior
  scrollMargin?: number
}

interface MessageScrollerScrollable {
  start: boolean
  end: boolean
}

interface MessageScrollerVisibilityState {
  currentAnchorId: string | null
  visibleMessageIds: string[]
}

const DEFAULT_SCROLL_EDGE_THRESHOLD = 8
const DEFAULT_SCROLL_PREVIOUS_ITEM_PEEK = 64
const DEFAULT_SCROLL_MARGIN = 0
const SCROLL_EPSILON = 0.5
const AUTOSCROLL_SETTLE_MS = 180
const SCROLL_INTENT_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
  " ",
])

const NOT_SCROLLABLE: MessageScrollerScrollable = { start: false, end: false }
const EMPTY_VISIBILITY: MessageScrollerVisibilityState = {
  currentAnchorId: null,
  visibleMessageIds: [],
}

function applyRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value)
  } else if (ref !== null && ref !== undefined) {
    ref.current = value
  }
}

function messageElements(
  content: HTMLElement,
  spacer: HTMLElement | null
): HTMLElement[] {
  return Array.from(content.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child !== spacer
  )
}

function findAnchorFrom(
  items: HTMLElement[],
  startIndex: number
): HTMLElement | null {
  for (let index = startIndex; index < items.length; index++) {
    const item = items[index]
    if (item?.dataset.scrollAnchor === "true") return item
  }
  return null
}

function findUnhandledAnchor(
  items: HTMLElement[],
  handled: WeakSet<HTMLElement>
): HTMLElement | null {
  for (const item of items) {
    if (item.dataset.scrollAnchor === "true" && !handled.has(item)) return item
  }
  return null
}

function hasMultipleAnchorsFrom(
  items: HTMLElement[],
  startIndex: number
): boolean {
  let count = 0
  for (let index = startIndex; index < items.length; index++) {
    if (items[index]?.dataset.scrollAnchor === "true") {
      count += 1
      if (count > 1) return true
    }
  }
  return false
}

function findLastAnchor(items: HTMLElement[]): HTMLElement | null {
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index]
    if (item?.dataset.scrollAnchor === "true") return item
  }
  return null
}

function offsetWithinViewport(
  element: HTMLElement,
  viewport: HTMLElement
): number {
  const elementRect = element.getBoundingClientRect()
  const viewportRect = viewport.getBoundingClientRect()
  return elementRect.top - viewportRect.top + viewport.scrollTop
}

function topRelativeToViewport(
  element: HTMLElement,
  viewport: HTMLElement
): number {
  return (
    element.getBoundingClientRect().top - viewport.getBoundingClientRect().top
  )
}

function maxScrollTop(viewport: HTMLElement): number {
  return Math.max(0, viewport.scrollHeight - viewport.clientHeight)
}

function blockPadding(element: HTMLElement): { start: number; end: number } {
  const style = window.getComputedStyle(element)
  return {
    end: parseCssLength(style.paddingBlockEnd || style.paddingBottom),
    start: parseCssLength(style.paddingBlockStart || style.paddingTop),
  }
}

function spacerContainerPadding(spacer: HTMLElement | null): {
  start: number
  end: number
} {
  const container = spacer?.parentElement
  return container ? blockPadding(container) : { end: 0, start: 0 }
}

function contentRowGap(element: HTMLElement | null): number {
  if (!element) return 0
  const style = window.getComputedStyle(element)
  const gap = style.rowGap === "normal" ? style.gap : style.rowGap
  return parseCssLength(gap)
}

function parseCssLength(value: string): number {
  if (!value) return 0
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

interface SnapshotStore<T> {
  getSnapshot: () => T
  hasListeners: () => boolean
  setSnapshot: (next: T) => void
  subscribe: (
    listener: () => void,
    onFirstListener?: () => void,
    onLastListener?: () => void
  ) => () => void
}

function createSnapshotStore<T>(
  initial: T,
  isEqual: (a: T, b: T) => boolean
): SnapshotStore<T> {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    hasListeners: () => listeners.size > 0,
    setSnapshot: (next) => {
      if (isEqual(snapshot, next)) return
      snapshot = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener, onFirstListener, onLastListener) => {
      const wasEmpty = listeners.size === 0
      listeners.add(listener)
      if (wasEmpty) onFirstListener?.()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) onLastListener?.()
      }
    },
  }
}

function scrollableEqual(
  a: MessageScrollerScrollable,
  b: MessageScrollerScrollable
): boolean {
  return a.start === b.start && a.end === b.end
}

function visibilityEqual(
  a: MessageScrollerVisibilityState,
  b: MessageScrollerVisibilityState
): boolean {
  if (
    a.currentAnchorId !== b.currentAnchorId ||
    a.visibleMessageIds.length !== b.visibleMessageIds.length
  ) {
    return false
  }
  return a.visibleMessageIds.every(
    (id, index) => id === b.visibleMessageIds[index]
  )
}

interface ScrollerEngineOptions {
  autoScroll: boolean
  defaultScrollPosition: MessageScrollerDefaultScrollPosition
  scrollEdgeThreshold: number
  scrollPreviousItemPeek: number
  scrollMargin: number
}

interface PendingScrollToMessage {
  messageId: string
  options: MessageScrollerScrollOptions | undefined
}

interface PrependRestore {
  element: HTMLElement
  viewportTop: number
}

/**
 * All scroll behavior lives in one long-lived closure so React components
 * only wire DOM elements, events, and current props into it.
 */
function createScrollerEngine(initialOptions: ScrollerEngineOptions) {
  let currentOptions = initialOptions
  const options = () => currentOptions

  let root: HTMLElement | null = null
  let viewport: HTMLElement | null = null
  let content: HTMLElement | null = null
  let spacer: HTMLElement | null = null

  let mode: ScrollMode = options().autoScroll
    ? "following-bottom"
    : "free-scrolling"
  let autoscrolling = false
  let autoscrollingTimeout: number | null = null
  let stateFrame: number | null = null
  let visibilityFrame: number | null = null
  let pendingScrollFrame: number | null = null

  let itemCount = 0
  let firstItem: HTMLElement | null = null
  let streamingTurn: HTMLElement | null = null
  let pendingScrollToMessage: PendingScrollToMessage | null = null
  let prependRestore: PrependRestore | null = null
  let defaultScrollPositionApplied = false
  let spacerGap = 0
  let spacerHeight = 0
  let preserveScrollOnPrepend = true

  const registeredMessages = new Map<string, HTMLElement>()
  const visibleMessageIds = new Set<string>()
  const handledScrollAnchors = new WeakSet<HTMLElement>()
  let visibilityObserver: IntersectionObserver | null = null

  const stateStore = createSnapshotStore(NOT_SCROLLABLE, scrollableEqual)
  const visibilityStore = createSnapshotStore(EMPTY_VISIBILITY, visibilityEqual)

  function computeScrollableState(): MessageScrollerScrollable {
    if (!viewport || !content) return NOT_SCROLLABLE
    return {
      start: viewport.scrollTop > options().scrollEdgeThreshold,
      end:
        computeContentEnd(content, viewport) -
          viewport.scrollTop -
          viewport.clientHeight >
        options().scrollEdgeThreshold,
    }
  }

  function computeVisibilityState(): MessageScrollerVisibilityState {
    if (!content || !viewport) return EMPTY_VISIBILITY
    const viewportRect = viewport.getBoundingClientRect()
    const anchorLine =
      viewportRect.top +
      options().scrollMargin +
      options().scrollPreviousItemPeek
    const withoutObserver = typeof IntersectionObserver === "undefined"
    const visible: string[] = []
    let currentAnchorId: string | null = null
    for (const item of messageElements(content, spacer)) {
      const messageId = item.dataset.messageId
      if (!messageId) continue
      const isAnchor = item.dataset.scrollAnchor === "true"
      const rect =
        isAnchor || withoutObserver ? item.getBoundingClientRect() : null
      const isVisible =
        withoutObserver && rect
          ? rect.bottom > anchorLine && rect.top < viewportRect.bottom
          : visibleMessageIds.has(messageId)
      if (isVisible) visible.push(messageId)
      if (isAnchor && rect && rect.top <= anchorLine + SCROLL_EPSILON) {
        currentAnchorId = messageId
      }
    }
    return visible.length === 0 && currentAnchorId === null
      ? EMPTY_VISIBILITY
      : { currentAnchorId, visibleMessageIds: visible }
  }

  function computeContentEnd(
    contentElement: HTMLElement,
    viewportElement: HTMLElement
  ): number {
    const items = messageElements(contentElement, spacer)
    const padding = blockPadding(contentElement)
    const viewportRect = viewportElement.getBoundingClientRect()
    const scrollTop = viewportElement.scrollTop
    let end = padding.start + padding.end
    for (const item of items) {
      const rect = item.getBoundingClientRect()
      end = Math.max(
        end,
        rect.bottom - viewportRect.top + scrollTop + padding.end
      )
    }
    return end
  }

  function computeTargetScrollTop({
    align,
    element,
    scrollMargin,
    viewportElement,
  }: {
    align: MessageScrollerScrollAlign
    element: HTMLElement
    scrollMargin: number
    viewportElement: HTMLElement
  }): number {
    const offsetTop = offsetWithinViewport(element, viewportElement)
    const elementHeight = element.getBoundingClientRect().height
    const padding = spacerContainerPadding(spacer)
    if (align === "center") {
      const available = Math.max(
        0,
        viewportElement.clientHeight - padding.start - padding.end
      )
      return (
        offsetTop -
        padding.start -
        (available - elementHeight) / 2 -
        scrollMargin
      )
    }
    if (align === "end") {
      return (
        offsetTop -
        viewportElement.clientHeight +
        elementHeight +
        padding.end +
        scrollMargin
      )
    }
    if (align === "nearest") {
      const elementBottom = offsetTop + elementHeight
      const visibleTop = viewportElement.scrollTop + padding.start
      const visibleBottom =
        viewportElement.scrollTop + viewportElement.clientHeight - padding.end
      if (offsetTop >= visibleTop && elementBottom <= visibleBottom) {
        return viewportElement.scrollTop
      }
      return offsetTop < visibleTop
        ? offsetTop - padding.start - scrollMargin
        : elementBottom -
            viewportElement.clientHeight +
            padding.end +
            scrollMargin
    }
    return offsetTop - padding.start - scrollMargin
  }

  function firstItemInView(): HTMLElement | null {
    if (!content || !viewport) return null
    const viewportRect = viewport.getBoundingClientRect()
    for (const item of messageElements(content, spacer)) {
      if (!item.dataset.messageId) continue
      const rect = item.getBoundingClientRect()
      if (rect.bottom > viewportRect.top && rect.top < viewportRect.bottom) {
        return item
      }
    }
    return null
  }

  function applyScrollableAttributes(state: MessageScrollerScrollable) {
    const scrollable = [state.start && "start", state.end && "end"]
      .filter(Boolean)
      .join(" ")
    for (const element of [root, viewport]) {
      if (!element) continue
      if (scrollable) {
        element.setAttribute("data-scrollable", scrollable)
      } else {
        element.removeAttribute("data-scrollable")
      }
      element.toggleAttribute("data-autoscrolling", autoscrolling)
    }
  }

  function updateModeFromScrollable(state: MessageScrollerScrollable) {
    if (options().autoScroll && !state.end && mode !== "settling-jump") {
      mode = "following-bottom"
    } else if (mode === "following-bottom" && state.end && !autoscrolling) {
      mode = "free-scrolling"
    }
  }

  function commitScrollState() {
    const state = computeScrollableState()
    updateModeFromScrollable(state)
    applyScrollableAttributes(state)
    stateStore.setSnapshot(state)
  }

  function scheduleStateCommit() {
    if (stateFrame !== null) return
    stateFrame = window.requestAnimationFrame(() => {
      stateFrame = null
      commitScrollState()
    })
  }

  function scheduleVisibilitySync() {
    if (!visibilityStore.hasListeners()) return
    if (visibilityFrame !== null) return
    visibilityFrame = window.requestAnimationFrame(() => {
      visibilityFrame = null
      if (!visibilityStore.hasListeners()) return
      visibilityStore.setSnapshot(computeVisibilityState())
    })
  }

  function setAutoscrolling(active: boolean) {
    if (autoscrollingTimeout !== null) {
      window.clearTimeout(autoscrollingTimeout)
      autoscrollingTimeout = null
    }
    if (autoscrolling !== active) {
      autoscrolling = active
      commitScrollState()
    }
    if (active) {
      autoscrollingTimeout = window.setTimeout(() => {
        autoscrollingTimeout = null
        autoscrolling = false
        commitScrollState()
      }, AUTOSCROLL_SETTLE_MS)
    }
  }

  function setSpacerHeight(height: number) {
    if (!spacer) return
    const next = Math.max(0, Math.ceil(height))
    if (spacerHeight === next) return
    spacerHeight = next
    spacer.hidden = next === 0
    spacer.style.height = `${next}px`
    spacer.style.marginTop = next > 0 ? `${-spacerGap}px` : ""
  }

  function scrollTo(
    top: number,
    {
      behavior = "auto",
      isAutoscroll = false,
    }: { behavior?: ScrollBehavior; isAutoscroll?: boolean } = {}
  ) {
    if (!viewport) return
    const target = Math.max(0, top)
    if (Math.abs(viewport.scrollTop - target) <= SCROLL_EPSILON) {
      viewport.scrollTop = target
      commitScrollState()
      return
    }
    if (isAutoscroll) setAutoscrolling(true)
    viewport.scrollTo({ top: target, behavior })
    scheduleStateCommit()
  }

  function scrollToStart({
    behavior = "auto",
  }: { behavior?: ScrollBehavior } = {}) {
    if (!viewport) return false
    setSpacerHeight(0)
    streamingTurn = null
    mode = "free-scrolling"
    scrollTo(0, { behavior })
    scheduleVisibilitySync()
    return true
  }

  function scrollToEnd({
    behavior = "auto",
  }: { behavior?: ScrollBehavior } = {}) {
    if (!viewport) return false
    setSpacerHeight(0)
    streamingTurn = null
    mode = options().autoScroll ? "following-bottom" : "free-scrolling"
    scrollTo(maxScrollTop(viewport), { isAutoscroll: true, behavior })
    scheduleVisibilitySync()
    return true
  }

  function scrollToElement(
    element: HTMLElement,
    {
      align = "start",
      behavior = "auto",
      scrollMargin = options().scrollMargin,
    }: MessageScrollerScrollOptions = {},
    { keepPreviousPeek = false }: { keepPreviousPeek?: boolean } = {}
  ) {
    if (!content || !viewport || !content.contains(element)) return false
    const target = computeTargetScrollTop({
      align,
      element,
      scrollMargin: keepPreviousPeek
        ? scrollMargin + options().scrollPreviousItemPeek
        : scrollMargin,
      viewportElement: viewport,
    })
    setSpacerHeight(
      target + viewport.clientHeight - computeContentEnd(content, viewport)
    )
    prependRestore = {
      element,
      viewportTop: topRelativeToViewport(element, viewport),
    }
    mode = keepPreviousPeek ? "anchored-to-message" : "settling-jump"
    streamingTurn = keepPreviousPeek ? element : null
    scrollTo(target, { behavior })
    scheduleVisibilitySync()
    return true
  }

  function reanchorToAnchoredMessage() {
    if (
      !streamingTurn ||
      !streamingTurn.isConnected ||
      mode !== "anchored-to-message"
    ) {
      return false
    }
    return scrollToElement(
      streamingTurn,
      { align: "start" },
      { keepPreviousPeek: true }
    )
  }

  function scrollToMessage(
    messageId: string,
    scrollOptions?: MessageScrollerScrollOptions
  ) {
    const element = registeredMessages.get(messageId)
    if (element) {
      defaultScrollPositionApplied = true
      if (scrollToElement(element, scrollOptions)) {
        pendingScrollToMessage = null
        return true
      }
      pendingScrollToMessage = { messageId, options: scrollOptions }
      return true
    }
    if (itemCount === 0) {
      pendingScrollToMessage = { messageId, options: scrollOptions }
      defaultScrollPositionApplied = true
      return true
    }
    return false
  }

  function flushPendingScrollToMessage() {
    if (!pendingScrollToMessage) return false
    const element = registeredMessages.get(pendingScrollToMessage.messageId)
    if (!element || !scrollToElement(element, pendingScrollToMessage.options)) {
      return false
    }
    pendingScrollToMessage = null
    defaultScrollPositionApplied = true
    return true
  }

  function restorePrependAnchor() {
    if (!prependRestore || !viewport || !prependRestore.element.isConnected) {
      return false
    }
    const delta =
      topRelativeToViewport(prependRestore.element, viewport) -
      prependRestore.viewportTop
    if (Math.abs(delta) <= SCROLL_EPSILON) return false
    viewport.scrollTop += delta
    prependRestore.viewportTop = topRelativeToViewport(
      prependRestore.element,
      viewport
    )
    scheduleStateCommit()
    scheduleVisibilitySync()
    return true
  }

  function capturePrependAnchor() {
    if (!content || !viewport) {
      prependRestore = null
      return
    }
    const element = firstItemInView()
    prependRestore = element
      ? { element, viewportTop: topRelativeToViewport(element, viewport) }
      : null
  }

  function schedulePendingScrollFlush() {
    if (pendingScrollFrame !== null) return
    pendingScrollFrame = window.requestAnimationFrame(() => {
      pendingScrollFrame = null
      if (flushPendingScrollToMessage()) capturePrependAnchor()
    })
  }

  function applyDefaultScrollPosition() {
    const { defaultScrollPosition } = options()
    if (defaultScrollPositionApplied || itemCount === 0) return false
    let applied = false
    if (defaultScrollPosition === "last-anchor") {
      const anchor =
        content && viewport
          ? findLastAnchor(messageElements(content, spacer))
          : null
      if (!content || !viewport || !anchor) {
        applied = scrollToEnd({ behavior: "auto" })
      } else {
        applied =
          computeContentEnd(content, viewport) -
            offsetWithinViewport(anchor, viewport) <=
          viewport.clientHeight
            ? scrollToEnd({ behavior: "auto" })
            : scrollToElement(
                anchor,
                { align: "start" },
                { keepPreviousPeek: true }
              )
      }
    } else {
      applied =
        defaultScrollPosition === "end"
          ? scrollToEnd({ behavior: "auto" })
          : scrollToStart({ behavior: "auto" })
    }
    if (!applied) return false
    defaultScrollPositionApplied = true
    return true
  }

  function handleContentChange() {
    if (!content) return
    const items = messageElements(content, spacer)
    const previousCount = itemCount
    const previousFirst = firstItem
    itemCount = items.length
    firstItem = items[0] ?? null
    reactToContentChange(items, previousCount, previousFirst)
    capturePrependAnchor()
  }

  function reactToContentChange(
    items: HTMLElement[],
    previousCount: number,
    previousFirst: HTMLElement | null
  ) {
    if (flushPendingScrollToMessage()) return
    if (previousCount === 0) {
      if (
        applyDefaultScrollPosition() ||
        (items.length > 0 &&
          options().autoScroll &&
          scrollToEnd({ behavior: "auto" }))
      ) {
        return
      }
      commitScrollState()
      scheduleVisibilitySync()
      return
    }
    const previousFirstIndex = previousFirst ? items.indexOf(previousFirst) : -1
    if (preserveScrollOnPrepend && previousFirstIndex > 0) {
      restorePrependAnchor()
      return
    }
    if (items.length > previousCount) {
      const anchor = findAnchorFrom(items, previousCount)
      if (anchor) {
        if (
          options().autoScroll &&
          mode === "following-bottom" &&
          hasMultipleAnchorsFrom(items, previousCount)
        ) {
          scrollToEnd({ behavior: "auto" })
          return
        }
        scrollToElement(anchor, { align: "start" }, { keepPreviousPeek: true })
        handledScrollAnchors.add(anchor)
        return
      }
    }
    if (items.length === previousCount) {
      const anchor = findUnhandledAnchor(items, handledScrollAnchors)
      if (anchor) {
        scrollToElement(anchor, { align: "start" }, { keepPreviousPeek: true })
        handledScrollAnchors.add(anchor)
        return
      }
    }
    if (mode === "following-bottom" && options().autoScroll) {
      scrollToEnd({ behavior: "auto" })
    } else {
      commitScrollState()
      scheduleVisibilitySync()
    }
  }

  function handleResize() {
    if (mode === "following-bottom" && options().autoScroll) {
      scrollToEnd({ behavior: "auto" })
      return
    }
    if (!reanchorToAnchoredMessage()) {
      scheduleStateCommit()
      scheduleVisibilitySync()
    }
  }

  function observeVisibility() {
    if (!viewport || !visibilityStore.hasListeners()) return
    if (typeof IntersectionObserver === "undefined") {
      scheduleVisibilitySync()
      return
    }
    if (!visibilityObserver) {
      visibilityObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const messageId =
              entry.target instanceof HTMLElement
                ? entry.target.dataset.messageId
                : undefined
            if (!messageId) continue
            if (entry.isIntersecting) {
              visibleMessageIds.add(messageId)
            } else {
              visibleMessageIds.delete(messageId)
            }
          }
          scheduleVisibilitySync()
        },
        {
          root: viewport,
          rootMargin: `${-(options().scrollMargin + options().scrollPreviousItemPeek)}px 0px 0px 0px`,
          threshold: [0, 0.01, 0.5, 1],
        }
      )
    }
    registeredMessages.forEach((element) => {
      visibilityObserver?.observe(element)
    })
    scheduleVisibilitySync()
  }

  function unobserveVisibility() {
    if (visibilityFrame !== null) {
      window.cancelAnimationFrame(visibilityFrame)
      visibilityFrame = null
    }
    visibilityObserver?.disconnect()
    visibilityObserver = null
    visibleMessageIds.clear()
    visibilityStore.setSnapshot(EMPTY_VISIBILITY)
  }

  function registerMessage(
    messageId: string,
    element: HTMLElement | null,
    previous: HTMLElement | null
  ) {
    if (element) {
      registeredMessages.set(messageId, element)
      visibilityObserver?.observe(element)
      scheduleVisibilitySync()
      if (pendingScrollToMessage?.messageId === messageId) {
        schedulePendingScrollFlush()
      }
      return
    }
    if (previous && registeredMessages.get(messageId) === previous) {
      registeredMessages.delete(messageId)
      visibleMessageIds.delete(messageId)
      visibilityObserver?.unobserve(previous)
      scheduleVisibilitySync()
    }
  }

  function userScrollIntent() {
    if (
      mode === "following-bottom" ||
      mode === "anchored-to-message" ||
      mode === "settling-jump"
    ) {
      streamingTurn = null
      mode = "free-scrolling"
    }
  }

  function syncAfterScroll() {
    commitScrollState()
    scheduleVisibilitySync()
    capturePrependAnchor()
  }

  function handleAutoScrollChange() {
    if (options().autoScroll && mode === "following-bottom" && itemCount > 0) {
      scrollToEnd({ behavior: "auto" })
      return
    }
    commitScrollState()
  }

  function dispose() {
    if (stateFrame !== null) {
      window.cancelAnimationFrame(stateFrame)
      stateFrame = null
    }
    if (visibilityFrame !== null) {
      window.cancelAnimationFrame(visibilityFrame)
      visibilityFrame = null
    }
    if (pendingScrollFrame !== null) {
      window.cancelAnimationFrame(pendingScrollFrame)
      pendingScrollFrame = null
    }
    if (autoscrollingTimeout !== null) {
      window.clearTimeout(autoscrollingTimeout)
      autoscrollingTimeout = null
    }
    visibilityObserver?.disconnect()
    visibilityObserver = null
  }

  function updateOptions(next: ScrollerEngineOptions) {
    if (next.defaultScrollPosition !== currentOptions.defaultScrollPosition) {
      defaultScrollPositionApplied = false
    }
    currentOptions = next
  }

  return {
    applyDefaultScrollPosition,
    dispose,
    updateOptions,
    handleAutoScrollChange,
    handleContentChange,
    handleResize,
    observeVisibility,
    registerMessage,
    scrollToEnd,
    scrollToMessage,
    scrollToStart,
    setContentElement: (element: HTMLElement | null) => {
      content = element
    },
    setPreserveScrollOnPrepend: (value: boolean) => {
      preserveScrollOnPrepend = value
    },
    setRootElement: (element: HTMLElement | null) => {
      root = element
      if (element) applyScrollableAttributes(stateStore.getSnapshot())
    },
    setSpacerElement: (element: HTMLElement | null) => {
      spacer = element
      spacerGap = contentRowGap(element?.parentElement ?? null)
    },
    setViewportElement: (element: HTMLElement | null) => {
      viewport = element
      if (element) applyScrollableAttributes(stateStore.getSnapshot())
    },
    stateStore,
    syncAfterScroll,
    unobserveVisibility,
    userScrollIntent,
    visibilityStore,
  }
}

type ScrollerEngine = ReturnType<typeof createScrollerEngine>

const MessageScrollerContext = React.createContext<ScrollerEngine | null>(null)

function useScrollerEngine(): ScrollerEngine {
  const engine = React.useContext(MessageScrollerContext)
  if (!engine) {
    throw new Error("useMessageScroller must be used within a MessageScroller.")
  }
  return engine
}

/** Imperative scrolling for the enclosing `MessageScrollerProvider`. */
function useMessageScroller() {
  const engine = useScrollerEngine()
  return React.useMemo(
    () => ({
      scrollToEnd: engine.scrollToEnd,
      scrollToMessage: engine.scrollToMessage,
      scrollToStart: engine.scrollToStart,
    }),
    [engine]
  )
}

/** Whether content extends beyond the viewport toward each edge. */
function useMessageScrollerScrollable(): MessageScrollerScrollable {
  const { stateStore } = useScrollerEngine()
  return React.useSyncExternalStore(
    stateStore.subscribe,
    stateStore.getSnapshot,
    stateStore.getSnapshot
  )
}

/**
 * The anchor item currently pinned at the reading line and the visible
 * message ids. Requires items rendered with `messageId`.
 */
function useMessageScrollerVisibility(): MessageScrollerVisibilityState {
  const engine = useScrollerEngine()
  const subscribe = React.useCallback(
    (listener: () => void) =>
      engine.visibilityStore.subscribe(
        listener,
        engine.observeVisibility,
        engine.unobserveVisibility
      ),
    [engine]
  )
  return React.useSyncExternalStore(
    subscribe,
    engine.visibilityStore.getSnapshot,
    engine.visibilityStore.getSnapshot
  )
}

/**
 * Owns one conversation's scroll state. `autoScroll` keeps the viewport
 * pinned to the bottom while new content streams in; items rendered with
 * `scrollAnchor` pin to the top of the viewport instead so the reader can
 * follow a long answer from its start.
 */
function MessageScrollerProvider({
  autoScroll = false,
  children,
  defaultScrollPosition = "end",
  scrollEdgeThreshold = DEFAULT_SCROLL_EDGE_THRESHOLD,
  scrollPreviousItemPeek = DEFAULT_SCROLL_PREVIOUS_ITEM_PEEK,
  scrollMargin = DEFAULT_SCROLL_MARGIN,
}: {
  children?: React.ReactNode
  autoScroll?: boolean
  defaultScrollPosition?: MessageScrollerDefaultScrollPosition
  scrollEdgeThreshold?: number
  scrollPreviousItemPeek?: number
  scrollMargin?: number
}) {
  const [engine] = React.useState(() =>
    createScrollerEngine({
      autoScroll,
      defaultScrollPosition,
      scrollEdgeThreshold,
      scrollPreviousItemPeek,
      scrollMargin,
    })
  )
  // Updated during render so child layout effects, which run before this
  // component's own effects, already observe the current props. The update
  // is idempotent, so re-renders stay safe.
  engine.updateOptions({
    autoScroll,
    defaultScrollPosition,
    scrollEdgeThreshold,
    scrollPreviousItemPeek,
    scrollMargin,
  })

  React.useLayoutEffect(() => {
    engine.applyDefaultScrollPosition()
  }, [engine, defaultScrollPosition])

  React.useLayoutEffect(() => {
    engine.handleAutoScrollChange()
  }, [engine, autoScroll])

  React.useEffect(() => () => engine.dispose(), [engine])

  return (
    <MessageScrollerContext.Provider value={engine}>
      {children}
    </MessageScrollerContext.Provider>
  )
}

function MessageScroller({ className, ...props }: React.ComponentProps<"div">) {
  const engine = useScrollerEngine()
  return (
    <div
      ref={(element) => engine.setRootElement(element)}
      data-slot="message-scroller"
      className={cn(
        "group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function MessageScrollerViewport({
  "aria-label": ariaLabel = "Messages",
  className,
  onKeyDown,
  onScroll,
  onTouchMove,
  onWheel,
  preserveScrollOnPrepend = true,
  ref,
  role = "region",
  tabIndex = 0,
  ...props
}: React.ComponentProps<"div"> & {
  preserveScrollOnPrepend?: boolean
}) {
  const engine = useScrollerEngine()
  engine.setPreserveScrollOnPrepend(preserveScrollOnPrepend)

  const viewportElementRef = React.useRef<HTMLDivElement | null>(null)
  const composedRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      viewportElementRef.current = element
      engine.setViewportElement(element)
      applyRef(ref, element)
    },
    [engine, ref]
  )

  React.useEffect(() => {
    const viewport = viewportElementRef.current
    if (!viewport || typeof ResizeObserver === "undefined") return undefined
    const observer = new ResizeObserver(engine.handleResize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [engine])

  return (
    // The keydown listener only records scroll intent for keys the scroll
    // container natively handles; the viewport stays a focusable region.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={composedRef}
      data-slot="message-scroller-viewport"
      role={role}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      className={cn(
        "size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain contain-content",
        className
      )}
      onKeyDown={(event) => {
        if (SCROLL_INTENT_KEYS.has(event.key)) engine.userScrollIntent()
        onKeyDown?.(event)
      }}
      onScroll={(event) => {
        engine.syncAfterScroll()
        onScroll?.(event)
      }}
      onTouchMove={(event) => {
        engine.userScrollIntent()
        onTouchMove?.(event)
      }}
      onWheel={(event) => {
        engine.userScrollIntent()
        onWheel?.(event)
      }}
      {...props}
    />
  )
}

function MessageScrollerContent({
  "aria-relevant": ariaRelevant = "additions",
  className,
  children,
  ref,
  role = "log",
  spacerClassName,
  ...props
}: React.ComponentProps<"div"> & {
  spacerClassName?: string
}) {
  const engine = useScrollerEngine()
  const contentElementRef = React.useRef<HTMLDivElement | null>(null)

  const composedRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      contentElementRef.current = element
      engine.setContentElement(element)
      applyRef(ref, element)
    },
    [engine, ref]
  )

  React.useLayoutEffect(() => {
    const content = contentElementRef.current
    if (!content) return undefined
    engine.handleContentChange()
    if (typeof MutationObserver === "undefined") return undefined
    const observer = new MutationObserver(() => {
      engine.handleContentChange()
    })
    observer.observe(content, { childList: true })
    return () => observer.disconnect()
  }, [engine])

  React.useEffect(() => {
    const content = contentElementRef.current
    if (!content || typeof ResizeObserver === "undefined") return undefined
    const observer = new ResizeObserver(engine.handleResize)
    observer.observe(content)
    return () => observer.disconnect()
  }, [engine])

  return (
    <div
      ref={composedRef}
      data-slot="message-scroller-content"
      role={role}
      aria-relevant={ariaRelevant}
      className={cn("flex h-max min-h-full flex-col gap-6", className)}
      {...props}
    >
      {children}
      <div
        ref={(element) => engine.setSpacerElement(element)}
        aria-hidden="true"
        data-message-scroller-spacer=""
        hidden
        className={spacerClassName}
      />
    </div>
  )
}

function MessageScrollerItem({
  className,
  messageId,
  ref,
  scrollAnchor = false,
  ...props
}: React.ComponentProps<"div"> & {
  messageId?: string
  scrollAnchor?: boolean
}) {
  const engine = useScrollerEngine()
  const previousRef = React.useRef<HTMLDivElement | null>(null)

  const composedRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      const previous = previousRef.current
      previousRef.current = element
      if (messageId) engine.registerMessage(messageId, element, previous)
      applyRef(ref, element)
    },
    [engine, messageId, ref]
  )

  return (
    <div
      ref={composedRef}
      data-slot="message-scroller-item"
      data-message-id={messageId}
      data-scroll-anchor={scrollAnchor ? "true" : "false"}
      className={cn(
        "min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]",
        className
      )}
      {...props}
    />
  )
}

interface MessageScrollerButtonState extends Record<string, unknown> {
  active: boolean
  direction: MessageScrollerButtonDirection
}

/**
 * Floating jump control that appears once content extends past the viewport
 * in its direction and leaves the tab order otherwise.
 */
function MessageScrollerButton({
  behavior = "smooth",
  className,
  children,
  direction = "end",
  onClick,
  render,
  tabIndex,
  variant = "outline",
  size = "icon-sm",
  ...props
}: useRender.ComponentProps<"button", MessageScrollerButtonState> & {
  behavior?: ScrollBehavior
  direction?: MessageScrollerButtonDirection
} & Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  const engine = useScrollerEngine()

  const subscribe = React.useCallback(
    (listener: () => void) => engine.stateStore.subscribe(listener),
    [engine]
  )
  const getActive = React.useCallback(() => {
    const state = engine.stateStore.getSnapshot()
    return direction === "start" ? state.start : state.end
  }, [direction, engine])
  const active = React.useSyncExternalStore(subscribe, getActive, getActive)

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!active) return
      onClick?.(event)
      if (event.defaultPrevented) return
      event.currentTarget.blur()
      if (direction === "start") {
        engine.scrollToStart({ behavior })
      } else {
        engine.scrollToEnd({ behavior })
      }
    },
    [active, behavior, direction, engine, onClick]
  )

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: "button",
        inert: !active,
        tabIndex: active ? tabIndex : -1,
        className: cn(
          "absolute left-1/2 -translate-x-1/2 transition-[translate,scale,opacity] duration-200 data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[direction=end]:bottom-4 data-[direction=end]:data-[active=false]:translate-y-full data-[direction=start]:top-4 data-[direction=start]:data-[active=false]:-translate-y-full data-[direction=start]:[&_svg]:rotate-180",
          className
        ),
        children: children ?? (
          <>
            <ArrowDownIcon />
            <span className="sr-only">
              {direction === "end" ? "Scroll to end" : "Scroll to start"}
            </span>
          </>
        ),
        onClick: handleClick,
      },
      props
    ),
    render: render ?? <Button variant={variant} size={size} />,
    state: { active, direction },
    stateAttributesMapping: {
      active: (value) => ({ "data-active": value ? "true" : "false" }),
    },
  })
}

export {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
  type MessageScrollerScrollable,
  type MessageScrollerScrollOptions,
  type MessageScrollerVisibilityState,
}
