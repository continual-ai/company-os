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
import type { ClientRecord } from "#/runtime/ui/model/object-client.ts"
import { objectFieldValue } from "#/runtime/ui/model/object-field-value.ts"

it("reads link previews and expansions without flattening or colliding with record properties", () => {
  const fields = objectFields(Person, fixtureModel)
  const account = { id: "account_example", etag: "1", name: "Acme" }
  for (const accounts of [
    { ids: [account.id], totalSize: 12, totalSizeExact: true },
    { items: [account], totalSize: 12, totalSizeExact: true },
  ]) {
    const record: ClientRecord = {
      id: "person_example",
      etag: "1",
      name: "Ada",
      accountsTotalSize: 999,
      metadata: { source: "import" },
      links: { accounts },
    }
    expect(
      objectFieldValue(requireObjectField(fields, "accounts.$count"), record)
    ).toEqual({ kind: "count", totalSize: 12, totalSizeExact: true })
    expect(
      objectFieldValue(requireObjectField(fields, "accounts"), record)
    ).toEqual({
      kind: "link",
      ids: [account.id],
      totalSize: 12,
      totalSizeExact: true,
    })
    expect(
      objectFieldValue(
        requireObjectField(fields, "accounts.name"),
        record,
        () => ({ object: Account, record: account })
      )
    ).toEqual({
      kind: "values",
      values: ["Acme"],
      loadedSize: 1,
      totalSize: 12,
      totalSizeExact: true,
    })
    expect(
      objectFieldValue(requireObjectField(fields, "metadata"), record)
    ).toEqual({ kind: "scalar", value: record.metadata })
    expect(record.accountsTotalSize).toBe(999)
  }
})
