import { cn } from "@company/ui/lib/utils"
import { CheckIcon, CopyIcon } from "lucide-react"
import { Fragment, useEffect, useState } from "react"

import { Button } from "./button"
import type { CodeLanguage, highlightCode } from "./code-block-highlight"

/** Read-only snippets. Plain text is rendered during SSR and while the highlighter loads. */
export function CodeBlock({
  code,
  language = "text",
  label = "Code",
  className,
}: {
  code: string
  language?: CodeLanguage
  label?: string
  className?: string
}) {
  const [highlighted, setHighlighted] = useState<{
    code: string
    language: CodeLanguage
    tokens: Awaited<ReturnType<typeof highlightCode>>
  }>()
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  )

  useEffect(() => {
    if (language === "text") return undefined
    let active = true
    void import("./code-block-highlight")
      .then(({ highlightCode }) => highlightCode(code, language))
      .then(
        (tokens) => {
          if (active) setHighlighted({ code, language, tokens })
        },
        () => {
          /* Keep plain text readable if highlighting is unavailable. */
        }
      )
    return () => {
      active = false
    }
  }, [code, language])

  useEffect(() => {
    if (copyState === "idle") return undefined
    const timeout = setTimeout(() => setCopyState("idle"), 2000)
    return () => clearTimeout(timeout)
  }, [copyState])

  return (
    <div
      data-slot="code-block"
      className={cn(
        "min-w-0 overflow-hidden rounded-lg border bg-background",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">
          {label}
        </span>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          aria-label={`Copy ${label}`}
          onClick={() => {
            void navigator.clipboard.writeText(code).then(
              () => setCopyState("copied"),
              () => setCopyState("failed")
            )
          }}
        >
          {copyState === "copied" ? <CheckIcon /> : <CopyIcon />}
          <span aria-live="polite">
            {copyState === "copied"
              ? "Copied"
              : copyState === "failed"
                ? "Copy failed"
                : "Copy"}
          </span>
        </Button>
      </div>
      <pre
        // Scrollable code must be focusable for keyboard users.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        aria-label={label}
        className="overflow-x-auto p-4 text-xs leading-5 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <code>
          {highlighted?.code === code && highlighted.language === language
            ? highlighted.tokens.map((line, index) => (
                <Fragment key={index}>
                  {index > 0 ? "\n" : null}
                  {line.map((token) => (
                    <span key={token.offset} style={token.htmlStyle}>
                      {token.content}
                    </span>
                  ))}
                </Fragment>
              ))
            : code}
        </code>
      </pre>
    </div>
  )
}
