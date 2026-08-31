import { definePlugin } from "@oxlint/plugins"

import { filenameCaseRule } from "./rules/filename-case.ts"
import { noInternalReexportsRule } from "./rules/no-internal-reexports.ts"
import { noUnsafeSqlRule } from "./rules/no-unsafe-sql.ts"
import { packageBoundariesRule } from "./rules/package-boundaries.ts"
import { visualDriftRule } from "./rules/visual-drift.ts"

/** Source-owned Oxlint rules for Company OS repository conventions. */
const companyOsPlugin = definePlugin({
  meta: { name: "company-os" },
  rules: {
    "filename-case": filenameCaseRule,
    "no-internal-reexports": noInternalReexportsRule,
    "no-unsafe-sql": noUnsafeSqlRule,
    "package-boundaries": packageBoundariesRule,
    "visual-drift": visualDriftRule,
  },
})

export default companyOsPlugin
