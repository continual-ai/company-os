import type { BaseCodeOptions, FileContents } from "@pierre/diffs"
import type * as PierreReact from "@pierre/diffs/react"
import { useEffect, useState } from "react"

export const codeOptions = {
  theme: { light: "pierre-light", dark: "pierre-dark" },
  overflow: "scroll",
  // Shadow DOM needs explicit access to our inherited design tokens.
  unsafeCSS: `:host {
    color-scheme: var(--code-color-scheme, light);
    --diffs-font-family: var(--font-mono);
    --diffs-header-font-family: var(--font-sans);
    --diffs-font-size: 12px;
    --diffs-line-height: 20px;
    --diffs-bg: var(--background);
  }`,
} satisfies BaseCodeOptions

/** Keep SSR and the first client render readable until themes and languages are ready. */
export function useCodeRenderer(files: readonly FileContents[]) {
  const [renderer, setRenderer] = useState<{
    components: typeof PierreReact
    sourceFiles: readonly FileContents[]
    files: FileContents[]
  }>()
  useEffect(() => {
    let active = true
    void Promise.all([import("@pierre/diffs/react"), import("@pierre/diffs")])
      .then(
        async ([
          components,
          { resolveLanguage, preloadHighlighter, getFiletypeFromFileName },
        ]) => {
          const resolved = await Promise.all(
            files.map(async (file) => {
              const lang =
                file.lang?.toLowerCase() ?? getFiletypeFromFileName(file.name)
              const supported =
                lang === "text" || lang === "ansi"
                  ? lang
                  : await resolveLanguage(lang).then(
                      () => lang,
                      () => "text"
                    )
              return { ...file, lang: supported }
            })
          )
          await preloadHighlighter({
            themes: ["pierre-light", "pierre-dark"],
            langs: resolved.map((file) => file.lang),
          })
          if (active)
            setRenderer({ components, sourceFiles: files, files: resolved })
        }
      )
      .catch(() => {
        /* The plain-text fallback remains available. */
      })
    return () => {
      active = false
    }
  }, [files])
  return renderer?.sourceFiles === files ? renderer : undefined
}
