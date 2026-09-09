import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { Account, Person } from "#/runtime/testing/fixture-model.ts"
import { ObjectRecordStatusProgress } from "#/runtime/ui/model/object-record-status-progress.tsx"

it("renders the declared status order as record progress", () => {
  const html = renderToStaticMarkup(
    <ObjectRecordStatusProgress
      object={Account}
      record={{
        id: "account_example",
        name: "Example account",
        logo: null,
        domain: null,
        website: null,
        industry: "software",
        stage: "customer",
      }}
    />
  )

  expect(html).toContain('aria-label="Account status progress"')
  expect(html).toContain('aria-current="step"')
  expect(html).toContain("Prospect")
  expect(html).toContain("Customer")
  expect(html).toContain("Inactive")
})

it("does not render progress when an object has no display status", () => {
  const html = renderToStaticMarkup(
    <ObjectRecordStatusProgress
      object={Person}
      record={{
        id: "person_example",
        photo: null,
        name: "Example person",
        email: null,
        phone: null,
        consent: "unknown",
      }}
    />
  )

  expect(html).toBe("")
})
