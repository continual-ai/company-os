import { ObjectTable } from "@company/runtime/ui/model/object-table/object-table"
import { ModelUiProvider } from "@company/runtime/ui/model/runtime-context"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { Model } from "#/examples/model.ts"
import { presentation } from "#/examples/presentation.ts"

it("renders a read-only identity column when the model uses its record ID as title", () => {
  const html = renderToStaticMarkup(
    <ModelUiProvider value={presentation}>
      <ObjectTable
        object={Model.objects.roleAssignment}
        records={[
          {
            id: "role_assignment_example",
            parent: "platform_system",
            principal: "user_example",
            role: "role_example",
          },
        ]}
      />
    </ModelUiProvider>
  )
  expect(html).toContain("role_assignment_example")
  expect(html).toContain("Search Role assignments")
})
