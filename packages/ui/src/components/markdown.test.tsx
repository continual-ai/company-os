import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { Markdown, MarkdownText } from "#/components/markdown.tsx"

it("renders Markdown while keeping executable HTML and image fetching out of the document", () => {
  const html = renderToStaticMarkup(
    <Markdown>{`**Decision**

- [x] Reviewed

[Reference](https://example.com)

[Unsafe](javascript:alert%281%29)

<img src="https://example.com/tracker" onerror="alert(1)">

<script>alert(1)</script>

![Attachment](https://example.com/image.png)`}</Markdown>
  )
  expect(html).toContain("<strong>Decision</strong>")
  expect(html).toContain('type="checkbox"')
  expect(html).toContain('href="https://example.com"')
  expect(html).toContain('rel="noopener noreferrer"')
  expect(html).toContain('href="https://example.com/image.png"')
  expect(html).not.toMatch(/<script|<img|onerror|javascript:/)
})

it("flattens headings, lists, tables, and links into a noninteractive text preview", () => {
  const html = renderToStaticMarkup(
    <MarkdownText>{`# Summary

**Decision** and [reference](https://example.com).

- [x] Reviewed
- Next step

| Owner | Status |
| --- | --- |
| Ana | Ready |`}</MarkdownText>
  )
  expect(html).toContain("Summary")
  expect(html).toContain("Decision")
  expect(html).toContain("reference")
  expect(html).toContain("Reviewed")
  expect(html).toContain("Ana")
  expect(html).not.toMatch(/<(h1|p|ul|li|table|a|input|strong)\b/)
})
