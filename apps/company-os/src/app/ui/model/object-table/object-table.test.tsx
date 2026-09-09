import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import { presentation } from "#/app/app-presentation.ts"
import { ObjectTable } from "#/runtime/ui/model/object-table/object-table.tsx"
import { ModelUiProvider } from "#/runtime/ui/model/runtime-context.tsx"

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
