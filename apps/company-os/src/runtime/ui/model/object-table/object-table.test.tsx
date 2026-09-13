import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { ServiceAccount } from "#/runtime/access/model/index.ts"
import { PlatformUi } from "#/runtime/platform/ui/index.ts"
import {
  fixtureModel,
  Person,
  Account,
} from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { ObjectTable } from "#/runtime/ui/model/object-table/object-table.tsx"
import { ModelUiProvider } from "#/runtime/ui/model/runtime-context.tsx"

const presentation = testPresentation(fixtureModel, PlatformUi)

it("renders a service account using its display name", () => {
  const html = renderToStaticMarkup(
    <ModelUiProvider value={presentation}>
      <ObjectTable
        object={ServiceAccount}
        records={[
          {
            id: "service_account_example",
            name: "Automation",
            status: "active",
          },
        ]}
      />
    </ModelUiProvider>
  )
  expect(html).toContain("Automation")
  expect(html).toContain("Search Service accounts")
})

it("keeps row selection in its own pinned column", () => {
  const html = renderToStaticMarkup(
    <ModelUiProvider value={presentation}>
      <ObjectTable
        object={ServiceAccount}
        records={[
          {
            id: "service_account_example",
            name: "Automation",
            status: "active",
          },
        ]}
      />
    </ModelUiProvider>
  )

  expect(html).toMatch(
    /<td[^>]*>.*?Select row 1.*?<\/td>.*?<td[^>]*>.*?Automation/s
  )
})

it("renders related values and counts from column accessors", () => {
  const html = renderToStaticMarkup(
    <ModelUiProvider value={presentation}>
      <ObjectTable
        object={Person}
        records={[
          {
            id: "person_example",
            name: "Ada",
            accounts: ["account_example"],
            accountsTotalSize: 12,
          },
        ]}
        visiblePropertyIds={["name", "accounts.name", "accounts.$count"]}
        resolveRecord={() => ({
          object: Account,
          record: { id: "account_example", name: "Acme" },
        })}
      />
    </ModelUiProvider>
  )
  expect(html).toContain("Accounts → Count")
  expect(html).toContain("Acme")
  expect(html).toContain("+11 more")
  expect(html).toMatch(/>12</)
})
