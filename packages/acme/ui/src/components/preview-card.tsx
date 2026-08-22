"use client"

import { cn } from "@acme/ui/lib/utils"
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card"

function PreviewCard({ ...props }: PreviewCardPrimitive.Root.Props) {
  return <PreviewCardPrimitive.Root data-slot="preview-card" {...props} />
}

function PreviewCardTrigger({
  closeDelay = 120,
  delay = 350,
  ...props
}: PreviewCardPrimitive.Trigger.Props) {
  return (
    <PreviewCardPrimitive.Trigger
      data-slot="preview-card-trigger"
      closeDelay={closeDelay}
      delay={delay}
      {...props}
    />
  )
}

function PreviewCardContent({
  align = "start",
  alignOffset = 0,
  className,
  side = "bottom",
  sideOffset = 6,
  ...props
}: PreviewCardPrimitive.Popup.Props &
  Pick<
    PreviewCardPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <PreviewCardPrimitive.Portal>
      <PreviewCardPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PreviewCardPrimitive.Popup
          data-slot="preview-card-content"
          className={cn(
            "z-50 w-72 origin-(--transform-origin) rounded-none bg-popover p-3 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden will-change-[transform,opacity] data-[side=bottom]:slide-in-from-top-1 data-[side=inline-end]:slide-in-from-left-1 data-[side=inline-start]:slide-in-from-right-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 motion-reduce:animate-none data-open:animate-in data-open:duration-150 data-open:ease-out data-open:fade-in-0 data-open:zoom-in-98 data-closed:animate-out data-closed:duration-100 data-closed:ease-in data-closed:fade-out-0 data-closed:zoom-out-98",
            className
          )}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  )
}

export { PreviewCard, PreviewCardContent, PreviewCardTrigger }
