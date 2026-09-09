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

const IMPORT_BOUNDARIES = "company-os(import-boundaries)"
const NO_INTERNAL_REEXPORTS = "company-os(no-internal-reexports)"
const FILENAME_CASE = "company-os(filename-case)"

/** Expected diagnostic counts per fixture; fixtures absent here must lint clean. */
const expectedDiagnostics: Record<string, Record<string, number>> = {
  "apps/company-os/src/bad.Name.ts": { [FILENAME_CASE]: 1 },
  "apps/company-os/src/import-conventions.ts": {
    [IMPORT_BOUNDARIES]: 9,
    [NO_INTERNAL_REEXPORTS]: 1,
  },
  "apps/company-os/src/imports-template.ts": { [IMPORT_BOUNDARIES]: 2 },
  "apps/company-os/src/runtime/model/imports-server.ts": {
    [IMPORT_BOUNDARIES]: 3,
  },
  "apps/company-os/src/runtime/server/imports-modules.ts": {
    [IMPORT_BOUNDARIES]: 4,
  },
  "apps/company-os/src/runtime/server/internal-reexport.ts": {
    [NO_INTERNAL_REEXPORTS]: 1,
  },
  "apps/company-os/src/runtime/server/wildcard-reexport.ts": {
    [NO_INTERNAL_REEXPORTS]: 1,
  },
  "apps/company-os/src/runtime/access/server/imports-ui.ts": {
    [IMPORT_BOUNDARIES]: 1,
  },
  "apps/company-os/src/runtime/ui/imports-server.tsx": {
    [IMPORT_BOUNDARIES]: 2,
  },
  "apps/company-os/src/modules/sales/layout.ts": { [IMPORT_BOUNDARIES]: 1 },
  "apps/company-os/src/modules/sales/model/imports-effect.ts": {
    [IMPORT_BOUNDARIES]: 2,
  },
  "apps/company-os/src/modules/sales/server/imports-app.ts": {
    [IMPORT_BOUNDARIES]: 4,
  },
  "apps/company-os/src/modules/sales/server/harness.test.ts": {
    [IMPORT_BOUNDARIES]: 1,
  },
  "apps/company-os/src/modules/sales/seeds/composes-notes.ts": {
    [IMPORT_BOUNDARIES]: 1,
  },
  "apps/company-os/src/modules/sales/ui/imports-seeds.tsx": {
    [IMPORT_BOUNDARIES]: 2,
  },
  "apps/company-os/src/runtime/ui/components/imports-model.tsx": {
    [IMPORT_BOUNDARIES]: 2,
  },
  "apps/company-os/src/app/ui/imports-server.tsx": { [IMPORT_BOUNDARIES]: 2 },
  "apps/company-os/src/routes/imports-server.tsx": { [IMPORT_BOUNDARIES]: 1 },
  "templates/base/src/imports-central-internals.tsx": {
    [IMPORT_BOUNDARIES]: 2,
  },
}

describe("Company OS Oxlint rules", () => {
  it("enforces import direction, module layout, and public entrypoints", () => {
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

    const actual: Record<string, Record<string, number>> = {}
    for (const { code, filename } of parsed.diagnostics) {
      const fixture =
        filename
          .replaceAll("\\", "/")
          .split("fixtures/oxlint/company-os/")
          .at(-1) ?? filename
      const counts = (actual[fixture] ??= {})
      counts[code] = (counts[code] ?? 0) + 1
    }

    expect(actual).toEqual(expectedDiagnostics)
  })
})
