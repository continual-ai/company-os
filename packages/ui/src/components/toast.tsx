"use client"

import {
  Toast as ToastPrimitive,
  type ToastManagerAddOptions,
} from "@base-ui/react/toast"
import { cn } from "@company/ui/lib/utils"
import {
  CircleCheckIcon,
  InfoIcon,
  LoaderCircleIcon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import * as React from "react"

/**
 * Global manager backing the `toast` helpers. It must be connected to exactly
 * one mounted `Toaster`.
 */
const toastManager = ToastPrimitive.createToastManager()

type ToastOptions = Omit<
  ToastManagerAddOptions<Record<string, unknown>>,
  "title" | "type"
>

/** Imperative notifications; each call returns the toast id for `dismiss`. */
const toast = {
  message: (title: React.ReactNode, options?: ToastOptions) =>
    toastManager.add({ title, ...options }),
  success: (title: React.ReactNode, options?: ToastOptions) =>
    toastManager.add({ title, type: "success", ...options }),
  info: (title: React.ReactNode, options?: ToastOptions) =>
    toastManager.add({ title, type: "info", ...options }),
  warning: (title: React.ReactNode, options?: ToastOptions) =>
    toastManager.add({ title, type: "warning", ...options }),
  error: (title: React.ReactNode, options?: ToastOptions) =>
    toastManager.add({ title, type: "error", ...options }),
  loading: (title: React.ReactNode, options?: ToastOptions) =>
    toastManager.add({ title, type: "loading", timeout: 0, ...options }),
  dismiss: (id?: string) => {
    toastManager.close(id)
  },
}

const toastTypeIcons: Record<string, React.ReactNode> = {
  success: <CircleCheckIcon className="size-4" />,
  info: <InfoIcon className="size-4" />,
  warning: <TriangleAlertIcon className="size-4" />,
  error: <OctagonXIcon className="size-4" />,
  loading: <LoaderCircleIcon className="size-4 animate-spin" />,
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()

  return toasts.map((activeToast) => (
    <ToastPrimitive.Root
      key={activeToast.id}
      toast={activeToast}
      data-slot="toast"
      swipeDirection={["right", "down"]}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-2 rounded-none border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-md transition-all duration-200 select-none",
        "data-[ending-style]:opacity-0 data-[limited]:hidden data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0",
        "[transform:translate(var(--toast-swipe-movement-x),var(--toast-swipe-movement-y))]",
        (activeToast.type === "error" || activeToast.type === "warning") &&
          "[&>svg]:text-destructive"
      )}
    >
      {activeToast.type !== undefined ? toastTypeIcons[activeToast.type] : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <ToastPrimitive.Title
          data-slot="toast-title"
          className="font-medium wrap-break-word"
        />
        <ToastPrimitive.Description
          data-slot="toast-description"
          className="wrap-break-word text-muted-foreground"
        />
      </div>
      <ToastPrimitive.Close
        data-slot="toast-close"
        aria-label="Dismiss notification"
        className="flex size-5 shrink-0 items-center justify-center rounded-none text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring/50"
      >
        <XIcon className="size-3.5" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  ))
}

/**
 * Renders the notifications created through `toast`. Mount it once near the
 * application root.
 */
function Toaster(props: Omit<ToastPrimitive.Provider.Props, "toastManager">) {
  return (
    <ToastPrimitive.Provider toastManager={toastManager} {...props}>
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport
          data-slot="toast-viewport"
          className="fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col-reverse gap-2"
        >
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  )
}

export { toast, Toaster }
