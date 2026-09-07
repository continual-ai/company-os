import { cn } from "@company/ui/lib/utils"
import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
} from "lucide-react"
import { useEffect, useRef, useState, type ComponentProps } from "react"

import { Button } from "./button"
import { Markdown } from "./markdown"
import { Textarea } from "./textarea"

/** Controlled Markdown source with selection-aware formatting and a read-only preview. */
export function MarkdownEditor({
  value,
  onValueChange,
  className,
  ...props
}: Omit<ComponentProps<typeof Textarea>, "value" | "onChange"> & {
  value: string
  onValueChange: (value: string) => void
}) {
  const input = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)
  const invalid =
    props["aria-invalid"] === true || props["aria-invalid"] === "true"
  useEffect(() => {
    if (invalid) setPreview(false)
  }, [invalid])
  const format = (before: string, after: string, placeholder: string) => {
    const start = input.current?.selectionStart ?? value.length
    const end = input.current?.selectionEnd ?? start
    const selected = value.slice(start, end) || placeholder
    onValueChange(
      value.slice(0, start) + before + selected + after + value.slice(end)
    )
    requestAnimationFrame(() => {
      input.current?.focus()
      input.current?.setSelectionRange(
        start + before.length,
        start + before.length + selected.length
      )
    })
  }
  return (
    <div className="overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring/40">
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-2 py-1">
        <Button
          type="button"
          size="sm"
          variant={!preview ? "secondary" : "ghost"}
          aria-pressed={!preview}
          onClick={() => setPreview(false)}
        >
          Write
        </Button>
        <Button
          type="button"
          size="sm"
          variant={preview ? "secondary" : "ghost"}
          aria-pressed={preview}
          disabled={invalid}
          onClick={() => setPreview(true)}
        >
          Preview
        </Button>
        <div className="ml-auto flex gap-0.5">
          {[
            {
              label: "Bold",
              icon: BoldIcon,
              before: "**",
              after: "**",
              text: "text",
            },
            {
              label: "Italic",
              icon: ItalicIcon,
              before: "_",
              after: "_",
              text: "text",
            },
            {
              label: "Link",
              icon: LinkIcon,
              before: "[",
              after: "](https://example.com)",
              text: "link text",
            },
            {
              label: "List",
              icon: ListIcon,
              before: "\n- ",
              after: "",
              text: "item",
            },
            {
              label: "Code",
              icon: CodeIcon,
              before: "`",
              after: "`",
              text: "code",
            },
          ].map(({ label, icon: Icon, before, after, text }) => (
            <Button
              key={label}
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label={label}
              disabled={preview || props.disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => format(before, after, text)}
            >
              <Icon />
            </Button>
          ))}
        </div>
      </div>
      <Textarea
        {...props}
        ref={input}
        value={value}
        onChange={(event) => onValueChange(event.currentTarget.value)}
        hidden={preview}
        className={cn(
          "min-h-40 resize-y rounded-none border-0 p-3 shadow-none focus-visible:ring-0",
          preview && "hidden",
          className
        )}
        onKeyDown={(event) => {
          props.onKeyDown?.(event)
          if (
            !event.defaultPrevented &&
            (event.metaKey || event.ctrlKey) &&
            ["b", "i"].includes(event.key.toLowerCase())
          ) {
            event.preventDefault()
            if (event.key.toLowerCase() === "b") format("**", "**", "text")
            else format("_", "_", "text")
          }
        }}
      />
      {preview && (
        <section className="min-h-40 p-3" aria-label="Markdown preview">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing to preview yet.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
