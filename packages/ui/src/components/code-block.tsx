import { CheckIcon, CopyIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "#/components/button.tsx"
import { codeOptions, useCodeRenderer } from "#/components/code-renderer.ts"
import { cn } from "#/lib/utils.ts"

/** Read-only snippets. Plain text is rendered during SSR and while the highlighter loads. */
export function CodeBlock({
  code,
  language = "text",
  label = "Code",
  className,
}: {
  code: string
  language?: string
  label?: string
  className?: string
}) {
  const files = useMemo(
    () => [{ name: label, contents: code, lang: language }],
    [code, label, language]
  )
  const renderer = useCodeRenderer(files)
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  )

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
      {renderer ? (
        <renderer.components.File
          file={renderer.files[0]!}
          options={snippetOptions}
        />
      ) : (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        <pre tabIndex={0} aria-label={label} className="code-fallback">
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}

const snippetOptions = {
  ...codeOptions,
  disableFileHeader: true,
  disableLineNumbers: true,
}
