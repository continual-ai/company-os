import { definePlugin } from "@oxlint/plugins"

import { filenameCaseRule } from "./rules/filename-case.ts"
import { noInternalReexportsRule } from "./rules/no-internal-reexports.ts"
import { packageBoundariesRule } from "./rules/package-boundaries.ts"

/** Source-owned Oxlint rules for Company OS repository conventions. */
const companyOsPlugin = definePlugin({
  meta: { name: "company-os" },
  rules: {
    "filename-case": filenameCaseRule,
    "no-internal-reexports": noInternalReexportsRule,
    "package-boundaries": packageBoundariesRule,
  },
})

export default companyOsPlugin
