import { createHighlighterCore } from "@shikijs/core"
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript"
import bash from "@shikijs/langs/bash"
import json from "@shikijs/langs/json"
import sql from "@shikijs/langs/sql"
import tsx from "@shikijs/langs/tsx"
import typescript from "@shikijs/langs/typescript"
import dark from "@shikijs/themes/github-dark"
import light from "@shikijs/themes/github-light"

export type CodeLanguage =
  | "text"
  | "tsx"
  | "typescript"
  | "json"
  | "bash"
  | "sql"

const highlighter = createHighlighterCore({
  themes: [light, dark],
  langs: [tsx, typescript, json, bash, sql],
  engine: createJavaScriptRegexEngine(),
})

export async function highlightCode(code: string, language: CodeLanguage) {
  return (await highlighter).codeToTokens(code, {
    lang: language,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  }).tokens
}
