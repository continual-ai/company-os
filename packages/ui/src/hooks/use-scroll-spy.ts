import { useEffect, useState, type RefObject } from "react"

/** Tracks ordered sections in their nearest scrolling ancestor without changing the URL. */
export function useScrollSpy({
  containerRef,
  sectionIds,
  offset = 24,
}: {
  containerRef: RefObject<HTMLElement | null>
  sectionIds: ReadonlyArray<string>
  offset?: number
}) {
  const [activeId, setActiveId] = useState<string>()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const sections = sectionIds.flatMap((id) => {
      const element = document.getElementById(id)
      return element && container.contains(element) ? [element] : []
    })
    let frame = 0
    const update = () => {
      frame = 0
      // Resolve again after resizing: a nested desktop pane can become a document flow.
      let root: HTMLElement | null = container
      while (root) {
        if (
          /auto|scroll|overlay/.test(getComputedStyle(root).overflowY) &&
          root.scrollHeight > root.clientHeight
        )
          break
        root = root.parentElement
      }
      const scroller = root ?? document.scrollingElement
      const top = root
        ? Math.max(0, root.getBoundingClientRect().top + root.clientTop)
        : 0
      let current = sections[0]?.id
      for (const section of sections) {
        if (section.getBoundingClientRect().top > top + offset + 1) break
        current = section.id
      }
      // Short final sections may never reach the top of the reading pane.
      if (
        scroller &&
        scroller.scrollTop > 0 &&
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1
      ) {
        current = sections.at(-1)?.id
      }
      setActiveId(current)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(container)
    for (const section of sections) observer.observe(section)
    // Capture also covers ancestor scrollers and keyboard or anchor navigation.
    window.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    })
    window.addEventListener("resize", schedule)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("scroll", schedule, true)
      window.removeEventListener("resize", schedule)
    }
  }, [containerRef, sectionIds, offset])

  return activeId
}
