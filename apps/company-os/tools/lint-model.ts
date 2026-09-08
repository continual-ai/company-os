import { describeModel, lintModelDescription } from "@company/runtime/model"

import { Model } from "#/app.model.ts"

const diagnostics = lintModelDescription(describeModel(Model))
for (const diagnostic of diagnostics) {
  process.stderr.write(
    `${diagnostic.ruleId} ${diagnostic.path.join(".")}: ${diagnostic.message}\n`
  )
}
if (diagnostics.some(({ severity }) => severity === "error")) {
  process.exitCode = 1
} else {
  process.stdout.write("Model policy verified.\n")
}
