import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { RoleAssignment } from "#/runtime/access/model/index.ts"
import { AccessUi } from "#/runtime/access/ui/index.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { ObjectTable } from "#/runtime/ui/model/object-table/object-table.tsx"
import { ModelUiProvider } from "#/runtime/ui/model/runtime-context.tsx"

const presentation = testPresentation(fixtureModel, AccessUi)

it("renders a read-only identity column when the model uses its record ID as title", () => {
  const html = renderToStaticMarkup(
    <ModelUiProvider value={presentation}>
      <ObjectTable
        object={RoleAssignment}
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
