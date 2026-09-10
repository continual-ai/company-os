import type { ReactNode } from "react"
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
    <div data-slot="markdown" className={cn("markdown-prose", className)}>
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

function TextBlock({ children }: { children?: ReactNode }) {
  return <>{children} </>
}

function TextInline({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

const textComponents: Components = {
  h1: TextBlock,
  h2: TextBlock,
  h3: TextBlock,
  h4: TextBlock,
  h5: TextBlock,
  h6: TextBlock,
  p: TextBlock,
  ul: TextBlock,
  ol: TextBlock,
  li: TextBlock,
  blockquote: TextBlock,
  pre: TextBlock,
  table: TextBlock,
  thead: TextBlock,
  tbody: TextBlock,
  tr: TextBlock,
  th: TextBlock,
  td: TextBlock,
  strong: TextInline,
  em: TextInline,
  del: TextInline,
  code: TextInline,
  a: TextInline,
  br: () => " ",
  hr: () => " ",
  img: ({ alt }) => alt ?? "",
  input: () => null,
}

/** A single text line parsed with the same Markdown rules, without prose layout or interactive elements. */
export function MarkdownText({
  children,
  className,
}: {
  children: string
  className?: string | undefined
}) {
  return (
    <span
      data-slot="markdown-text"
      className={cn("block min-w-0 truncate", className)}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={textComponents}
      >
        {children}
      </ReactMarkdown>
    </span>
  )
}
