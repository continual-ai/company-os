import { spawnSync } from "node:child_process"

// Lists kernel files this checkout has changed relative to an upstream ref. Run it
// before an upgrade: every listed file is a place a merge can conflict and a
// reason to move that change into a module instead.
const ref = process.argv[2] ?? "upstream/main"
const kernel = "apps/company-os/src/runtime"
const result = spawnSync(
  "git",
  ["diff", "--stat", `${ref}...HEAD`, "--", kernel],
  {
    encoding: "utf8",
  }
)
if (result.status !== 0) {
  process.stderr.write(
    `Cannot compare with '${ref}'. Add the upstream remote (git remote add upstream <url>) and fetch it, or pass a ref.\n${result.stderr}`
  )
  process.exit(1)
}
if (result.stdout.trim() === "") {
  process.stdout.write(`No kernel changes relative to ${ref}.\n`)
} else {
  process.stdout.write(
    `Kernel files changed relative to ${ref}:\n${result.stdout}`
  )
}
