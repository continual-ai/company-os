import { DragDropProvider } from "@dnd-kit/react"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import {
  objectFields,
  requireObjectField,
} from "#/runtime/model/object-fields.ts"
import {
  Account,
  Person,
  fixtureModel,
} from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { CollectionCard } from "#/runtime/ui/model/collection-card.tsx"
import { ObjectFieldValue } from "#/runtime/ui/model/object-field.tsx"
import { ObjectPropertiesCard } from "#/runtime/ui/model/object-properties-card.tsx"
import { ModelUiProvider } from "#/runtime/ui/model/runtime-context.tsx"

const router = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory({ initialEntries: ["/"] }),
})
const runtime = testPresentation(fixtureModel)
const fields = objectFields(Person, fixtureModel)
const account = {
  id: "account_example",
  name: "Acme",
  stage: "customer",
  industry: null,
}
const references = new Map([[account.id, { object: Account, record: account }]])
const record = {
  id: "person_example",
  etag: "1",
  name: "Ada",
  email: null,
  phone: null,
  consent: "unknown",
  links: {
    accounts: { ids: [account.id], totalSize: 1000, totalSizeExact: false },
    billingAccount: account.id,
  },
}

it("preserves count accuracy, enum labels, and empty values in shared field rendering", () => {
  const render = (id: string) =>
    renderToStaticMarkup(
      <ObjectFieldValue
        field={requireObjectField(fields, id)}
        record={record}
        resolveRecord={(recordId) => references.get(recordId)}
      />
    )
  expect(render("accounts.$count")).toContain("1,000+")
  expect(render("accounts.stage")).toContain("Customer")
  expect(render("accounts.stage")).toContain("999+")
  expect(render("accounts.industry")).toContain("Empty")
  expect(render("email")).toContain("Empty")
})

it("renders all declared card fields and preserves mixed field order on details", () => {
  const columns = [
    "name",
    "billingAccount",
    "email",
    "phone",
    "consent",
    "accounts.$count",
  ]
  const html = renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <ModelUiProvider value={runtime}>
        <DragDropProvider>
          <CollectionCard
            record={record}
            presentation={{
              object: Person,
              columns,
              references,
              canMove: () => false,
              canEdit: () => false,
              onEdit: () => {},
              renderActions: () => null,
            }}
          />
        </DragDropProvider>
        <ObjectPropertiesCard
          object={Person}
          record={record}
          fields={columns.slice(1)}
          references={references}
        />
      </ModelUiProvider>
    </RouterContextProvider>
  )
  expect(html.match(/1,000\+/g)).toHaveLength(2)
  expect(html.match(/Acme/g)).toHaveLength(2)
  expect(html.indexOf('data-record-field="billingAccount"')).toBeLessThan(
    html.indexOf('data-record-field="email"')
  )
})
