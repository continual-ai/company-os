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

it("offers direct selection for every status when the caller supplies update authority", () => {
  const html = renderToStaticMarkup(
    <ObjectRecordStatusProgress
      object={Account}
      record={{ id: "account_example", stage: "customer" }}
      onChange={() => {}}
    />
  )
  expect(html).toContain("<button")
  expect(html).toContain('aria-label="Set stage to Customer"')
  expect(html).toContain('aria-label="Set stage to Prospect"')
  expect(html).toContain('aria-label="Set stage to Inactive"')
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
  expect(html).not.toContain("aria-haspopup")
  expect(html).toContain('data-record-field="stage"')
})

it("keeps the persisted selection and disables changes while another status saves", () => {
  const html = renderToStaticMarkup(
    <ObjectRecordStatusProgress
      object={Account}
      record={{ id: "account_example", stage: "customer" }}
      onChange={() => {}}
      pendingValue="inactive"
    />
  )
  expect(html).toContain('aria-busy="true"')
  expect(html.match(/ disabled=""/g)).toHaveLength(3)
  expect(html).toMatch(/aria-label="Set stage to Customer" aria-pressed="true"/)
  expect(html).toContain("Saving stage")
})

it("shows failed saves without changing the selected status", () => {
  const html = renderToStaticMarkup(
    <ObjectRecordStatusProgress
      object={Account}
      record={{ id: "account_example", stage: "customer" }}
      onChange={() => {}}
      error="This record has changed. Reload and try again."
    />
  )
  expect(html).toContain('role="alert"')
  expect(html).toContain("This record has changed.")
  expect(html).toMatch(/aria-label="Set stage to Customer" aria-pressed="true"/)
  expect(html).not.toContain('disabled=""')
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
