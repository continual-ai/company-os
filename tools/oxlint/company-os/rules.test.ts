import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

interface OxlintDiagnostic {
  readonly code: string
  readonly filename: string
}

interface OxlintOutput {
  readonly diagnostics: ReadonlyArray<OxlintDiagnostic>
}

function isOxlintOutput(value: unknown): value is OxlintOutput {
  return (
    typeof value === "object" &&
    value !== null &&
    "diagnostics" in value &&
    Array.isArray(value.diagnostics)
  )
}

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.."
)

describe("Company OS Oxlint rules", () => {
  it("reports every invalid fixture", () => {
    const result = spawnSync(
      resolve(repositoryRoot, "node_modules/.bin/oxlint"),
      [
        "--config=tools/oxlint/company-os/fixture-config.json",
        "--format=json",
        "--no-ignore",
        "fixtures/oxlint/company-os",
      ],
      { cwd: repositoryRoot, encoding: "utf8" }
    )

    expect(result.signal, result.stderr).toBeNull()
    expect(result.status, "Invalid rule fixtures must fail linting.").toBe(1)

    const parsed: unknown = JSON.parse(result.stdout)
    if (!isOxlintOutput(parsed)) {
      throw new Error("Oxlint JSON output must contain diagnostics.")
    }
    const actual = new Set(
      parsed.diagnostics.map(({ code, filename }) =>
        JSON.stringify({
          code,
          fixture: filename
            .replaceAll("\\", "/")
            .split("fixtures/oxlint/company-os/")
            .at(-1),
        })
      )
    )
    const expected = [
      {
        code: "company-os(filename-case)",
        fixture: "packages/runtime/src/bad.Name.ts",
      },
      {
        code: "company-os(no-internal-reexports)",
        fixture: "packages/runtime/src/index.ts",
      },
      {
        code: "company-os(no-internal-reexports)",
        fixture: "packages/runtime/src/internal-reexport.ts",
      },
      {
        code: "company-os(no-unsafe-sql)",
        fixture: "packages/runtime/src/unsafe-sql.ts",
      },
      {
        code: "company-os(package-boundaries)",
        fixture: "packages/runtime/src/wrong-boundary.ts",
      },
      {
        code: "company-os(visual-drift)",
        fixture: "apps/company-os/src/visual-drift.tsx",
      },
    ]

    expect(actual).toEqual(
      new Set(expected.map((diagnostic) => JSON.stringify(diagnostic)))
    )
  })
})
