import { IconButton } from "@company/ui/icon-button"
import { Markdown } from "@company/ui/markdown"
import { Link } from "@tanstack/react-router"
import { ArrowUpRightIcon } from "lucide-react"

import type { Note } from "#/modules/notes/model/index.ts"
import type { RecordSummaryProps, RecordUiProps } from "#/runtime/ui/module.ts"
import { RecordAttribution } from "#/runtime/ui/module.ts"

export function NoteSummary({
  record,
  author,
  href,
  variant,
  actions,
}: RecordSummaryProps<typeof Note>) {
  return (
    <article className="min-w-0 flex-1 space-y-3">
      <header className="flex items-center justify-between gap-2">
        <RecordAttribution record={record} author={author} />
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <IconButton
            label="Open note"
            nativeButton={false}
            render={<Link to={href} />}
          >
            <ArrowUpRightIcon />
          </IconButton>
        </div>
      </header>
      <Markdown className={variant === "preview" ? "line-clamp-4" : undefined}>
        {record.content}
      </Markdown>
    </article>
  )
}

export function NoteOverview({ record, author }: RecordUiProps<typeof Note>) {
  return (
    <section className="mb-6 max-w-3xl space-y-4">
      <RecordAttribution record={record} author={author} />
      <Markdown>{record.content}</Markdown>
    </section>
  )
}
