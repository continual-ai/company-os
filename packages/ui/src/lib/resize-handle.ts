/** Shared affordance for sidebar rails and panel separators. */
export const resizeHandleClassName =
  "resize-handle touch-none outline-none after:pointer-events-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:bg-transparent hover:after:bg-muted-foreground/40 focus-visible:after:bg-ring data-[separator=hover]:after:bg-muted-foreground/40 data-[separator=active]:after:bg-ring data-[resizing=true]:after:bg-ring aria-[orientation=horizontal]:after:inset-x-0 aria-[orientation=horizontal]:after:top-1/2 aria-[orientation=horizontal]:after:h-0.5 aria-[orientation=horizontal]:after:w-auto aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2"

export const resizeHandleTitle = "Drag to resize; double-click to reset"
