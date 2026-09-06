import { Model } from "company-os/model"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { ObjectTable } from "./object-table"

it("renders a read-only identity column when the model uses its record ID as title", () => {
  const html = renderToStaticMarkup(
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
  )
  expect(html).toContain("role_assignment_example")
  expect(html).toContain("Search Role assignments")
})
