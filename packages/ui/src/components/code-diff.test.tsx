import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { CodeDiff } from "#/components/code-diff.tsx"

it("keeps both versions readable and escaped before the interactive diff loads", () => {
  const html = renderToStaticMarkup(
    <CodeDiff
      oldFile={{ name: "value.ts", contents: "const value = '<old>'" }}
      newFile={{ name: "value.ts", contents: "const value = '<new>'" }}
    />
  )
  expect(html).toContain("Before · value.ts")
  expect(html).toContain("After · value.ts")
  expect(html).toContain("&lt;old&gt;")
  expect(html).toContain("&lt;new&gt;")
})
