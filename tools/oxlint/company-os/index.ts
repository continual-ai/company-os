import { definePlugin } from "@oxlint/plugins"

import { filenameCaseRule } from "#/oxlint/company-os/rules/filename-case.ts"
import { importBoundariesRule } from "#/oxlint/company-os/rules/import-boundaries.ts"
import { noInternalReexportsRule } from "#/oxlint/company-os/rules/no-internal-reexports.ts"

/** Source-owned Oxlint rules for Company OS repository conventions. */
const companyOsPlugin = definePlugin({
  meta: { name: "company-os" },
  rules: {
    "filename-case": filenameCaseRule,
    "import-boundaries": importBoundariesRule,
    "no-internal-reexports": noInternalReexportsRule,
  },
})

export default companyOsPlugin
