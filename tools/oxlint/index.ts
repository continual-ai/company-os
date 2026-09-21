import { definePlugin } from "@oxlint/plugins"

import { filenameCaseRule } from "#/oxlint/rules/filename-case.ts"
import { importBoundariesRule } from "#/oxlint/rules/import-boundaries.ts"
import { noInternalReexportsRule } from "#/oxlint/rules/no-internal-reexports.ts"

/** Source-owned Oxlint rules for repository conventions. */
const repositoryPlugin = definePlugin({
  meta: { name: "repo" },
  rules: {
    "filename-case": filenameCaseRule,
    "import-boundaries": importBoundariesRule,
    "no-internal-reexports": noInternalReexportsRule,
  },
})

export default repositoryPlugin
