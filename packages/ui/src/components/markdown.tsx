import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "#/lib/utils.ts"

const components: Components = {
  a: ({ href, children: label }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  ),
  img: ({ src, alt }) => (
    <a href={src} target="_blank" rel="noopener noreferrer">
      {alt || "View image"}
    </a>
  ),
}

/** CommonMark and GFM without executable HTML. Remote images remain explicit links. */
export function Markdown({
  children,
  className,
}: {
  children: string
  className?: string | undefined
}) {
  return (
    <div
      className={cn(
        "min-w-0 text-sm leading-relaxed wrap-break-word [&_.contains-task-list]:list-none [&_.contains-task-list]:pl-0 [&_.task-list-item_input]:mr-1.5 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:font-mono [&_code]:text-xs [&_h1]:my-3 [&_h1]:text-xl [&_h2]:my-3 [&_h2]:text-lg [&_h3]:my-2 [&_h3]:font-semibold [&_hr]:my-4 [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:px-2 [&_th]:border [&_th]:px-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
