import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { ServiceAccount } from "#/runtime/access/model/index.ts"
import { objectFields } from "#/runtime/model/object-fields.ts"
import { PlatformUi } from "#/runtime/platform/ui/index.ts"
import {
  fixtureModel,
  Person,
  Account,
} from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import type { ClientRecord } from "#/runtime/ui/model/object-client.ts"
import { isObjectTableCellEditable } from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
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
            links: { accounts: { ids: ["account_example"], totalSize: 12 } },
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

it("renders standard resource columns from records with expanded links", () => {
  const record: ClientRecord = {
    id: "person_example",
    etag: "v1",
    name: "Ada",
    createdAt: "2026-09-15T12:00:00.000Z",
    updatedAt: "2026-09-16T12:00:00.000Z",
    createdBy: "user_author",
    updatedBy: "user_editor",
    metadata: { source: "import" },
    aliases: ["external:ada"],
    links: {
      accounts: {
        items: [{ id: "account_example", etag: "v1", name: "Acme" }],
        totalSize: 1,
      },
    },
  }
  const html = renderToStaticMarkup(
    <ModelUiProvider value={presentation}>
      <ObjectTable
        object={Person}
        records={[record]}
        visiblePropertyIds={[
          "name",
          "createdAt",
          "updatedAt",
          "createdBy",
          "updatedBy",
          "metadata",
          "aliases",
        ]}
      />
    </ModelUiProvider>
  )
  for (const label of [
    "Created at",
    "Updated at",
    "Created by",
    "Updated by",
    "Metadata",
    "Aliases",
    "user_author",
    "user_editor",
    "import",
    "external:ada",
  ]) {
    expect(html).toContain(label)
  }
  expect(record.createdAt).toBe("2026-09-15T12:00:00.000Z")
  expect(record.links?.accounts).toMatchObject({ totalSize: 1 })
  for (const { id: key, property } of objectFields(Person)) {
    if (["createdAt", "updatedAt", "createdBy", "updatedBy"].includes(key)) {
      expect(isObjectTableCellEditable(property)).toBe(false)
    }
  }
})
