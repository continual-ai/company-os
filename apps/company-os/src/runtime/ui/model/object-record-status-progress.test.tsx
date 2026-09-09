import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { Account, Person } from "#/runtime/testing/fixture-model.ts"
import { ObjectRecordStatusProgress } from "#/runtime/ui/model/object-record-status-progress.tsx"

it("derives progression from the primary enum and shows each state once", () => {
  const html = renderToStaticMarkup(
    <ObjectRecordStatusProgress
      object={Account}
      record={{ id: "account_example", stage: "customer" }}
    />
  )
  expect(html).toContain("Customer")
  expect(html).toContain("Prospect")
  expect(html).toContain("Inactive")
  expect(html).toContain('aria-current="step"')
  expect(html.indexOf("Prospect")).toBeLessThan(html.indexOf("Customer"))
  expect(html.indexOf("Customer")).toBeLessThan(html.indexOf("Inactive"))
  expect(html.match(/>Customer</g)).toHaveLength(1)
  expect(html).not.toContain("<button")
})

it("offers field editing only when the caller supplies edit authority", () => {
  const html = renderToStaticMarkup(
    <ObjectRecordStatusProgress
      object={Account}
      record={{ id: "account_example", stage: "customer" }}
      onEdit={() => {}}
    />
  )
  expect(html).toContain("<button")
  expect(html).toContain('aria-label="Edit Stage: Customer"')
  expect(html).toContain('data-record-field="stage"')
})

it("keeps unrecognized states visible", () => {
  const html = renderToStaticMarkup(
    <ObjectRecordStatusProgress
      object={Account}
      record={{ id: "account_example", stage: "legacy" }}
    />
  )
  expect(html).toContain("legacy")
})

it("omits the state control for objects without a display status", () => {
  expect(
    renderToStaticMarkup(
      <ObjectRecordStatusProgress
        object={Person}
        record={{ id: "person_example" }}
      />
    )
  ).toBe("")
})
