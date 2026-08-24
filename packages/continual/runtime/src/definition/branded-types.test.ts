import { expect, expectTypeOf, it } from "vitest"

import { Etag } from "./object"
import { IdempotencyKey, PageToken } from "./request"
import {
  CalendarDate,
  CurrencyCode,
  Decimal,
  DomainName,
  EmailAddress,
  MAX_RECORD_ALIAS_LENGTH,
  RecordAlias,
  type RecordIdentifier,
  PhoneNumber,
  RecordId,
  Timestamp,
  WebUrl,
} from "./schema"

it("constructs nominally distinct standard values through validated brands", () => {
  const AccountId = RecordId("account")
  const accountId = AccountId("account_1")

  expectTypeOf(accountId).toEqualTypeOf<RecordId<"account">>()
  expectTypeOf<RecordId<"account"> | RecordAlias>().toEqualTypeOf<
    RecordIdentifier<"account">
  >()
  expect(accountId).toBe("account_1")
  expect(Etag("etag_1")).toBe("etag_1")
  expect(PageToken("account_1")).toBe("account_1")
  expect(IdempotencyKey("request_1")).toBe("request_1")
  expect(CalendarDate("2026-08-20")).toBe("2026-08-20")
  expect(CurrencyCode("USD")).toBe("USD")
  expect(Decimal("1250.00")).toBe("1250.00")
  expect(DomainName("acme.example")).toBe("acme.example")
  expect(EmailAddress("ada@acme.example")).toBe("ada@acme.example")
  expect(PhoneNumber("+1 415 555 0100")).toBe("+1 415 555 0100")
  expect(RecordAlias("hubspot:portal_1:company:123")).toBe(
    "hubspot:portal_1:company:123"
  )
  expect(Timestamp("2026-08-20T12:00:00Z")).toBe("2026-08-20T12:00:00Z")
  expect(WebUrl("https://acme.example")).toBe("https://acme.example")
})

it("rejects invalid values before branding them", () => {
  expect(() => Etag("")).toThrow()
  expect(() => PageToken("")).toThrow()
  expect(() => IdempotencyKey("")).toThrow()
  expect(() => RecordId("account")("")).toThrow()
  expect(() => RecordId("account")("legacy:account:1")).toThrow()
  expect(() => CalendarDate("08/20/2026")).toThrow()
  expect(() => CurrencyCode("usd")).toThrow()
  expect(() => Decimal("01")).toThrow()
  expect(() => DomainName("not a domain")).toThrow()
  expect(() => EmailAddress("not an email")).toThrow()
  expect(() => PhoneNumber("123")).toThrow()
  expect(() => RecordAlias("")).toThrow()
  expect(() => RecordAlias("unqualified")).toThrow()
  expect(() =>
    RecordAlias(`system:${"a".repeat(MAX_RECORD_ALIAS_LENGTH)}`)
  ).toThrow()
  expect(() => Timestamp("yesterday")).toThrow()
  expect(() => WebUrl("ftp://acme.example")).toThrow()
})
