import { Button } from "@company/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@company/ui/components/tooltip"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

export function RecordIdentifier({ value }: { readonly value: string }) {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(
    () => () => {
      clearTimeout(resetTimer.current)
    },
    []
  )

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="-my-0.5 max-w-full gap-0 overflow-hidden bg-muted/20 p-0 font-normal hover:bg-muted/50"
            aria-label={copied ? "Record ID copied" : "Copy record ID"}
            onClick={() => {
              clearTimeout(resetTimer.current)
              void navigator.clipboard.writeText(value).then(
                () => {
                  setCopied(true)
                  resetTimer.current = setTimeout(() => setCopied(false), 1600)
                },
                () => setCopied(false)
              )
            }}
          />
        }
      >
        <span className="flex h-full shrink-0 items-center border-r bg-muted px-1.5 font-mono text-[9px] font-medium tracking-wide text-muted-foreground uppercase">
          id
        </span>
        <code className="min-w-0 truncate px-2 font-mono text-[11px] text-foreground/75">
          {value}
        </code>
        <span className="flex h-full shrink-0 items-center border-l px-1.5 text-muted-foreground">
          {copied ? (
            <CheckIcon className="size-3 text-foreground" />
          ) : (
            <CopyIcon className="size-3" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied" : "Copy record ID"}</TooltipContent>
    </Tooltip>
  )
}
