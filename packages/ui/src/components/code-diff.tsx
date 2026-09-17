import type { FileContents } from "@pierre/diffs"
import { useMemo } from "react"

import { codeOptions, useCodeRenderer } from "#/components/code-renderer.ts"
import { cn } from "#/lib/utils.ts"

export function CodeDiff({
  oldFile,
  newFile,
  layout = "unified",
  className,
}: {
  oldFile: FileContents
  newFile: FileContents
  layout?: "unified" | "split"
  className?: string
}) {
  const files = useMemo(() => [oldFile, newFile], [oldFile, newFile])
  const renderer = useCodeRenderer(files)
  const options = useMemo(
    () => ({ ...codeOptions, diffStyle: layout }),
    [layout]
  )
  return (
    <div
      data-slot="code-diff"
      className={cn(
        "min-w-0 overflow-hidden rounded-lg border bg-background",
        className
      )}
    >
      {renderer ? (
        <renderer.components.MultiFileDiff
          oldFile={renderer.files[0]!}
          newFile={renderer.files[1]!}
          options={options}
        />
      ) : (
        <>
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">
            Before · {oldFile.name}
          </div>
          <pre className="code-fallback">
            <code>{oldFile.contents}</code>
          </pre>
          <div className="border-y px-3 py-2 text-xs text-muted-foreground">
            After · {newFile.name}
          </div>
          <pre className="code-fallback">
            <code>{newFile.contents}</code>
          </pre>
        </>
      )}
    </div>
  )
}
