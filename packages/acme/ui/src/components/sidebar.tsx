"use client"

import { Button } from "@acme/ui/components/button"
import { Input } from "@acme/ui/components/input"
import { Separator } from "@acme/ui/components/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@acme/ui/components/sheet"
import { Skeleton } from "@acme/ui/components/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@acme/ui/components/tooltip"
import { useIsMobile } from "@acme/ui/hooks/use-mobile"
import { cn } from "@acme/ui/lib/utils"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { PanelLeftIcon } from "lucide-react"
import * as React from "react"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH_DEFAULT = 256
const SIDEBAR_WIDTH_MIN = 224
const SIDEBAR_WIDTH_MAX = 384
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"
const SIDEBAR_HOVER_CLOSE_DELAY = 120
const SIDEBAR_HOVER_EXIT_DURATION = 75
const sidebarSkeletonStyle: React.CSSProperties &
  Record<"--skeleton-width", string> = {
  "--skeleton-width": "70%",
}

function getSidebarSide(element: HTMLElement): "left" | "right" {
  return element.closest<HTMLElement>("[data-side]")?.dataset.side === "right"
    ? "right"
    : "left"
}

type SidebarContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  width: number
  defaultWidth: number
  minWidth: number
  maxWidth: number
  resizable: boolean
  setWidth: (width: number) => void
  isResizing: boolean
  setIsResizing: (isResizing: boolean) => void
  hoverOpen: boolean
  hoverClosing: boolean
  revealOnHover: boolean
  showSidebarPreview: () => void
  scheduleSidebarPreviewClose: () => void
  cancelSidebarPreviewClose: () => void
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

function SidebarProvider({
  defaultOpen = true,
  defaultWidth = SIDEBAR_WIDTH_DEFAULT,
  minWidth = SIDEBAR_WIDTH_MIN,
  maxWidth = SIDEBAR_WIDTH_MAX,
  open: openProp,
  onOpenChange: setOpenProp,
  width: widthProp,
  onWidthChange: setWidthProp,
  resizable = false,
  revealOnHover = false,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  width?: number
  onWidthChange?: (width: number) => void
  resizable?: boolean
  revealOnHover?: boolean
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)
  const [isResizing, setIsResizing] = React.useState(false)
  const [hoverOpen, setHoverOpen] = React.useState(false)
  const [hoverClosing, setHoverClosing] = React.useState(false)
  const hoverCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const hoverAnimationTimer = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
  const hoverResetFrame = React.useRef<number | null>(null)
  const clampWidth = React.useCallback(
    (nextWidth: number) => Math.min(maxWidth, Math.max(minWidth, nextWidth)),
    [maxWidth, minWidth]
  )
  const [_width, _setWidth] = React.useState(() => clampWidth(defaultWidth))
  const width = clampWidth(widthProp ?? _width)
  const setWidth = React.useCallback(
    (nextWidth: number) => {
      const constrainedWidth = clampWidth(nextWidth)
      if (setWidthProp) {
        setWidthProp(constrainedWidth)
      } else {
        _setWidth(constrainedWidth)
      }
    },
    [clampWidth, setWidthProp]
  )

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (openState: boolean) => {
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }

      // This sets the cookie to keep the sidebar state.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    },
    [setOpenProp]
  )

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return isMobile
      ? setOpenMobile((currentOpen) => !currentOpen)
      : setOpen(!open)
  }, [isMobile, open, setOpen, setOpenMobile])

  const cancelSidebarPreviewClose = React.useCallback(() => {
    if (hoverCloseTimer.current) {
      clearTimeout(hoverCloseTimer.current)
      hoverCloseTimer.current = null
    }
    if (hoverAnimationTimer.current) {
      clearTimeout(hoverAnimationTimer.current)
      hoverAnimationTimer.current = null
    }
    if (hoverResetFrame.current) {
      cancelAnimationFrame(hoverResetFrame.current)
      hoverResetFrame.current = null
    }
  }, [])
  const showSidebarPreview = React.useCallback(() => {
    if (!revealOnHover || isMobile || open) return
    cancelSidebarPreviewClose()
    setHoverClosing(false)
    setHoverOpen(true)
  }, [cancelSidebarPreviewClose, isMobile, open, revealOnHover])
  const scheduleSidebarPreviewClose = React.useCallback(() => {
    if (!hoverOpen) return
    cancelSidebarPreviewClose()
    hoverCloseTimer.current = setTimeout(() => {
      hoverCloseTimer.current = null
      setHoverClosing(true)
      hoverAnimationTimer.current = setTimeout(() => {
        hoverAnimationTimer.current = null
        setHoverOpen(false)
        hoverResetFrame.current = requestAnimationFrame(() => {
          setHoverClosing(false)
          hoverResetFrame.current = null
        })
      }, SIDEBAR_HOVER_EXIT_DURATION)
    }, SIDEBAR_HOVER_CLOSE_DELAY)
  }, [cancelSidebarPreviewClose, hoverOpen])

  React.useEffect(() => {
    if (open || isMobile || !revealOnHover) {
      cancelSidebarPreviewClose()
      setHoverClosing(false)
      setHoverOpen(false)
    }
  }, [cancelSidebarPreviewClose, isMobile, open, revealOnHover])

  React.useEffect(() => cancelSidebarPreviewClose, [cancelSidebarPreviewClose])

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed"
  const sidebarStyle: React.CSSProperties &
    Record<"--sidebar-width" | "--sidebar-width-icon", string> = {
    ...style,
    "--sidebar-width": `${width}px`,
    "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
  }

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      width,
      defaultWidth: clampWidth(defaultWidth),
      minWidth,
      maxWidth,
      resizable,
      setWidth,
      isResizing,
      setIsResizing,
      hoverOpen,
      hoverClosing,
      revealOnHover,
      showSidebarPreview,
      scheduleSidebarPreviewClose,
      cancelSidebarPreviewClose,
    }),
    [
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      width,
      defaultWidth,
      minWidth,
      maxWidth,
      resizable,
      setWidth,
      isResizing,
      hoverOpen,
      hoverClosing,
      revealOnHover,
      showSidebarPreview,
      scheduleSidebarPreviewClose,
      cancelSidebarPreviewClose,
      clampWidth,
    ]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        data-resizing={isResizing ? "true" : undefined}
        style={sidebarStyle}
        className={cn(
          "group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  dir,
  onPointerEnter,
  onPointerLeave,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right"
  variant?: "sidebar" | "floating" | "inset"
  collapsible?: "offcanvas" | "icon" | "none"
}) {
  const {
    hoverClosing,
    hoverOpen,
    isMobile,
    openMobile,
    scheduleSidebarPreviewClose,
    setOpenMobile,
    showSidebarPreview,
    state,
  } = useSidebar()

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
          className
        )}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        style={style}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    const mobileSidebarStyle: React.CSSProperties &
      Record<"--sidebar-width", string> = {
      ...style,
      "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
    }

    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          dir={dir}
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
          style={mobileSidebarStyle}
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-hover-open={hoverOpen ? "true" : undefined}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-150 ease-out group-data-[resizing=true]/sidebar-wrapper:transition-none",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )}
      />
      <div
        data-slot="sidebar-container"
        data-side={side}
        className={cn(
          "fixed inset-y-0 z-30 hidden h-svh w-(--sidebar-width) transition-[left,right,width,opacity] duration-150 ease-out group-data-[collapsible=offcanvas]:opacity-0 group-data-[resizing=true]/sidebar-wrapper:transition-none data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)] md:flex",
          hoverOpen && (side === "left" ? "left-0!" : "right-0!"),
          hoverClosing
            ? side === "left"
              ? "animate-out transition-none duration-75 ease-out fade-out-0 fill-mode-forwards slide-out-to-left-2 motion-reduce:animate-none"
              : "animate-out transition-none duration-75 ease-out fade-out-0 fill-mode-forwards slide-out-to-right-2 motion-reduce:animate-none"
            : hoverOpen &&
                (side === "left"
                  ? "animate-in transition-none duration-100 ease-out fade-in-0 slide-in-from-left-2 motion-reduce:animate-none"
                  : "animate-in transition-none duration-100 ease-out fade-in-0 slide-in-from-right-2 motion-reduce:animate-none"),
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className
        )}
        onPointerEnter={(event) => {
          onPointerEnter?.(event)
          if (!event.defaultPrevented) showSidebarPreview()
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event)
          if (!event.defaultPrevented) scheduleSidebarPreviewClose()
        }}
        style={{ ...style, opacity: hoverOpen ? 1 : undefined }}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="flex size-full flex-col bg-sidebar group-data-[hover-open=true]:shadow-xl group-data-[hover-open=true]:ring-1 group-data-[hover-open=true]:ring-sidebar-border group-data-[variant=floating]:rounded-none group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      className={cn(className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeftIcon />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}

function SidebarRail({
  className,
  onClick,
  onDoubleClick,
  onKeyDown,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  ...props
}: React.ComponentProps<"button">) {
  const {
    defaultWidth,
    isMobile,
    maxWidth,
    minWidth,
    resizable,
    setIsResizing,
    setWidth,
    showSidebarPreview,
    state,
    toggleSidebar,
    width,
  } = useSidebar()
  const dragState = React.useRef<{
    pointerId: number
    side: "left" | "right"
    startWidth: number
    startX: number
  } | null>(null)
  const previousBodyStyle = React.useRef<{
    cursor: string
    userSelect: string
  } | null>(null)
  const removeWindowListeners = React.useRef<(() => void) | null>(null)

  const stopResizing = React.useCallback(() => {
    removeWindowListeners.current?.()
    removeWindowListeners.current = null
    dragState.current = null
    setIsResizing(false)
    if (previousBodyStyle.current) {
      document.body.style.cursor = previousBodyStyle.current.cursor
      document.body.style.userSelect = previousBodyStyle.current.userSelect
      previousBodyStyle.current = null
    }
  }, [setIsResizing])

  React.useEffect(() => stopResizing, [stopResizing])

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label={
        resizable && state === "expanded" ? "Resize Sidebar" : "Toggle Sidebar"
      }
      aria-orientation={
        resizable && state === "expanded" ? "vertical" : undefined
      }
      aria-valuemax={resizable && state === "expanded" ? maxWidth : undefined}
      aria-valuemin={resizable && state === "expanded" ? minWidth : undefined}
      aria-valuenow={resizable && state === "expanded" ? width : undefined}
      role={resizable && state === "expanded" ? "separator" : undefined}
      tabIndex={resizable && state === "expanded" ? 0 : -1}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented && (!resizable || state === "collapsed")) {
          toggleSidebar()
        }
      }}
      onDoubleClick={(event) => {
        onDoubleClick?.(event)
        if (!event.defaultPrevented && resizable && state === "expanded") {
          setWidth(defaultWidth)
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented || !resizable || state !== "expanded") {
          return
        }

        const side = getSidebarSide(event.currentTarget)
        const direction = side === "left" ? 1 : -1
        if (event.key === "ArrowLeft") {
          event.preventDefault()
          setWidth(width - 8 * direction)
        } else if (event.key === "ArrowRight") {
          event.preventDefault()
          setWidth(width + 8 * direction)
        } else if (event.key === "Home") {
          event.preventDefault()
          setWidth(minWidth)
        } else if (event.key === "End") {
          event.preventDefault()
          setWidth(maxWidth)
        }
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          isMobile ||
          !resizable ||
          state !== "expanded"
        ) {
          return
        }

        event.preventDefault()
        dragState.current = {
          pointerId: event.pointerId,
          side: getSidebarSide(event.currentTarget),
          startWidth: width,
          startX: event.clientX,
        }
        previousBodyStyle.current = {
          cursor: document.body.style.cursor,
          userSelect: document.body.style.userSelect,
        }
        document.body.style.cursor = "col-resize"
        document.body.style.userSelect = "none"
        const handlePointerMove = (pointerEvent: PointerEvent) => {
          const drag = dragState.current
          if (drag?.pointerId !== pointerEvent.pointerId) return
          const direction = drag.side === "left" ? 1 : -1
          setWidth(
            drag.startWidth + (pointerEvent.clientX - drag.startX) * direction
          )
        }
        const handlePointerEnd = (pointerEvent: PointerEvent) => {
          if (dragState.current?.pointerId === pointerEvent.pointerId) {
            stopResizing()
          }
        }
        window.addEventListener("pointermove", handlePointerMove)
        window.addEventListener("pointerup", handlePointerEnd)
        window.addEventListener("pointercancel", handlePointerEnd)
        removeWindowListeners.current = () => {
          window.removeEventListener("pointermove", handlePointerMove)
          window.removeEventListener("pointerup", handlePointerEnd)
          window.removeEventListener("pointercancel", handlePointerEnd)
        }
        setIsResizing(true)
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event)
        if (!event.defaultPrevented) showSidebarPreview()
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event)
      }}
      title={
        resizable && state === "expanded"
          ? "Drag to resize; double-click to reset"
          : "Toggle Sidebar"
      }
      className={cn(
        "absolute inset-y-0 z-20 hidden w-4 touch-none transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:start-1/2 after:w-[2px] hover:after:bg-sidebar-border sm:flex ltr:-translate-x-1/2 rtl:-translate-x-1/2",
        resizable && state === "expanded"
          ? "cursor-col-resize"
          : "cursor-pointer",
        "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "relative flex w-full flex-1 flex-col bg-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn("h-8 w-full bg-background shadow-none", className)}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("mx-2 w-auto bg-sidebar-border", className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "no-scrollbar flex min-h-0 flex-1 flex-col gap-0 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & React.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "flex h-8 shrink-0 items-center rounded-none px-2 text-xs text-sidebar-foreground/70 ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-group-label",
      sidebar: "group-label",
    },
  })
}

function SidebarGroupAction({
  className,
  render,
  ...props
}: useRender.ComponentProps<"button"> & React.ComponentProps<"button">) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          "absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-none p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-group-action",
      sidebar: "group-action",
    },
  })
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("w-full text-xs", className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-0", className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  )
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-none p-2 text-left text-xs ring-sidebar-ring outline-hidden transition-[width,height,padding] group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:hover:bg-sidebar-accent data-open:hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
      },
      size: {
        default: "h-8 text-xs",
        sm: "h-7 text-xs",
        lg: "h-12 text-xs group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function SidebarMenuButton({
  render,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: useRender.ComponentProps<"button"> &
  React.ComponentProps<"button"> & {
    isActive?: boolean
    tooltip?: React.ReactNode
  } & VariantProps<typeof sidebarMenuButtonVariants>) {
  const { isMobile, state } = useSidebar()
  const comp = useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(sidebarMenuButtonVariants({ variant, size }), className),
      },
      props
    ),
    render: !tooltip ? render : <TooltipTrigger render={render} />,
    state: {
      slot: "sidebar-menu-button",
      sidebar: "menu-button",
      size,
      active: isActive,
    },
  })

  if (!tooltip) {
    return comp
  }

  return (
    <Tooltip>
      {comp}
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

function SidebarMenuAction({
  className,
  render,
  showOnHover = false,
  ...props
}: useRender.ComponentProps<"button"> &
  React.ComponentProps<"button"> & {
    showOnHover?: boolean
  }) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          "absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-none p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
          showOnHover &&
            "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-sidebar-accent-foreground aria-expanded:opacity-100 md:opacity-0",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-menu-action",
      sidebar: "menu-action",
    },
  })
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-none px-1 text-xs font-medium text-sidebar-foreground tabular-nums select-none group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 peer-data-active/menu-button:text-sidebar-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean
}) {
  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-none px-2", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-none"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={sidebarSkeletonStyle}
      />
    </div>
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5 group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("group/menu-sub-item relative", className)}
      {...props}
    />
  )
}

function SidebarMenuSubButton({
  render,
  size = "md",
  isActive = false,
  className,
  ...props
}: useRender.ComponentProps<"a"> &
  React.ComponentProps<"a"> & {
    size?: "sm" | "md"
    isActive?: boolean
  }) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-none px-2 text-sidebar-foreground ring-sidebar-ring outline-hidden group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[size=md]:text-xs data-[size=sm]:text-xs data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-menu-sub-button",
      sidebar: "menu-sub-button",
      size,
      active: isActive,
    },
  })
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
}
