import { strict as assert } from "node:assert"
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

interface OxlintDiagnostic {
  readonly code: string
  readonly filename: string
}

interface OxlintOutput {
  readonly diagnostics: ReadonlyArray<OxlintDiagnostic>
}

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.."
)
const result = spawnSync(
  resolve(repositoryRoot, "node_modules/.bin/oxlint"),
  [
    "--config=tools/oxlint/company-os/fixture-config.json",
    "--format=json",
    "--no-ignore",
    "tools/oxlint/company-os/fixtures",
  ],
  { cwd: repositoryRoot, encoding: "utf8" }
)

assert.equal(result.signal, null, result.stderr)
assert.equal(result.status, 1, "Invalid rule fixtures must fail linting.")
const parsed: unknown = JSON.parse(result.stdout)
assert.ok(
  typeof parsed === "object" &&
    parsed !== null &&
    "diagnostics" in parsed &&
    Array.isArray(parsed.diagnostics),
  "Oxlint JSON output must contain diagnostics."
)
const output: OxlintOutput = { diagnostics: parsed.diagnostics }
const actual = new Set(
  output.diagnostics.map(({ code, filename }) =>
    JSON.stringify({
      code,
      fixture: filename.replaceAll("\\", "/").split("/fixtures/").at(-1),
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
]
assert.equal(actual.size, expected.length)
for (const diagnostic of expected) {
  assert.ok(actual.has(JSON.stringify(diagnostic)), JSON.stringify(diagnostic))
}

console.log(`Verified ${actual.size} Company OS lint-rule fixtures.`)
