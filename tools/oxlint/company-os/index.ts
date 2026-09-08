import { definePlugin } from "@oxlint/plugins"

import { filenameCaseRule } from "#/oxlint/company-os/rules/filename-case.ts"
import { noInternalReexportsRule } from "#/oxlint/company-os/rules/no-internal-reexports.ts"
import { packageBoundariesRule } from "#/oxlint/company-os/rules/package-boundaries.ts"
import { visualDriftRule } from "#/oxlint/company-os/rules/visual-drift.ts"

/** Source-owned Oxlint rules for Company OS repository conventions. */
const companyOsPlugin = definePlugin({
  meta: { name: "company-os" },
  rules: {
    "filename-case": filenameCaseRule,
    "no-internal-reexports": noInternalReexportsRule,
    "package-boundaries": packageBoundariesRule,
    "visual-drift": visualDriftRule,
  },
})

export default companyOsPlugin
