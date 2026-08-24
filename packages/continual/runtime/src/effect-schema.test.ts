import { Schema } from "effect"
import { describe, expect, expectTypeOf, it } from "vitest"

import {
  defineObject,
  type Etag,
  type ObjectCreateInput,
  type RecordAliasUpdate,
  type ObjectRecord,
  type ObjectUpdateInput,
} from "./definition/object"
import { defineRoot } from "./definition/root"
import {
  RecordAlias,
  RecordId,
  schema,
  type EmailAddress,
  type InferInputSchema,
  type InferSchema,
  type RecordAlias as RecordAliasType,
  type RecordIdentifier,
} from "./definition/schema"
import {
  toEffectInputSchema,
  toEffectObjectCreateSchema,
  toEffectObjectSchema,
  toEffectObjectUpdateSchema,
  toEffectSchema,
} from "./effect-schema"

const AccountId = RecordId("account")
const Platform = defineRoot({ id: "platform", name: "Platform" })

const Account = defineObject({
  id: "account",
  collection: "accounts",
  name: "Account",
  parent: Platform,
  pluralName: "Accounts",
  properties: {
    logo: schema.image({ aspectRatio: 1, nullable: true }),
    externalId: schema.string({ immutable: true }),
    name: schema.string({ minLength: 1 }),
    email: schema.email({ nullable: true }),
    status: schema.select({
      default: "active",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    }),
  },
  display: { title: "name", status: "status" },
})

describe("Effect Schema projection", () => {
  it("canonicalizes semantic string inputs before validation", () => {
    const decodeEmail = Schema.decodeUnknownSync(
      toEffectInputSchema(schema.email())
    )
    const decodeDomain = Schema.decodeUnknownSync(
      toEffectInputSchema(schema.domain())
    )

    expect(decodeEmail("  Hello@Example.COM  ")).toBe("hello@example.com")
    expect(decodeDomain("  ACME.Example  ")).toBe("acme.example")
  })

  it("decodes records from portable object definitions", () => {
    const decode = Schema.decodeUnknownSync(toEffectObjectSchema(Account))
    const base = {
      aliases: ["hubspot:portal_1:company:account_1"],
      metadata: {},
      id: "account_1",
      createdAt: "2026-08-18T12:00:00Z",
      createdBy: "user_1",
      etag: "v1",
      parent: "platform_1",
      systemManaged: false,
      updatedAt: "2026-08-18T13:00:00.123Z",
      updatedBy: "user_1",
    }

    expect(
      decode({
        ...base,
        email: "hello@example.com",
        externalId: "external_1",
        logo: { assetId: "asset_1", alt: "Acme logo" },
        name: "Acme",
        status: "active",
      })
    ).toEqual({
      ...base,
      email: "hello@example.com",
      externalId: "external_1",
      logo: { assetId: "asset_1", alt: "Acme logo" },
      name: "Acme",
      status: "active",
    })
    expect(() =>
      decode({
        ...base,
        email: null,
        externalId: "external_1",
        logo: null,
        name: "",
        status: "active",
      })
    ).toThrow()
    expect(() =>
      decode({
        ...base,
        externalId: "external_1",
        name: "Acme",
        email: "not-an-email",
        logo: null,
        status: "active",
      })
    ).toThrow()
    expect(() =>
      decode({
        ...base,
        externalId: "external_1",
        logo: { assetId: "" },
        email: null,
        name: "Acme",
        status: "active",
      })
    ).toThrow()
    expect(() =>
      decode({
        ...base,
        externalId: "external_1",
        createdAt: "yesterday",
        email: null,
        logo: null,
        name: "Acme",
        status: "active",
      })
    ).toThrow()
  })

  it("derives create and update inputs from object properties", () => {
    type AccountRecord = ObjectRecord<typeof Account>
    type Create = ObjectCreateInput<typeof Account>
    type Update = ObjectUpdateInput<typeof Account>

    const typedCreate = {
      externalId: "external_1",
      logo: { assetId: "asset_1" },
      name: "Acme",
    } satisfies Create
    const typedUpdate = {
      id: AccountId("account_1"),
      logo: null,
    } satisfies Update
    expect(typedCreate.logo.assetId).toBe("asset_1")
    expect(typedUpdate.logo).toBeNull()

    expectTypeOf<AccountRecord["email"]>().toEqualTypeOf<EmailAddress | null>()
    expectTypeOf<AccountRecord["logo"]>().toEqualTypeOf<{
      assetId: string
      alt?: string
    } | null>()
    expectTypeOf<Create["email"]>().toEqualTypeOf<
      EmailAddress | null | undefined
    >()
    expectTypeOf<Create["status"]>().toEqualTypeOf<
      "active" | "inactive" | undefined
    >()
    expectTypeOf<AccountRecord["status"]>().toEqualTypeOf<
      "active" | "inactive"
    >()
    expectTypeOf<Create["metadata"]>().toEqualTypeOf<
      Readonly<Record<string, string>> | undefined
    >()
    expectTypeOf<Create["aliases"]>().toEqualTypeOf<
      ReadonlyArray<RecordAliasType> | undefined
    >()
    expectTypeOf<Create["parent"]>().toEqualTypeOf<undefined>()
    expectTypeOf<AccountRecord["parent"]>().toEqualTypeOf<
      RecordId<"platform">
    >()
    expectTypeOf<Update["email"]>().toEqualTypeOf<
      EmailAddress | null | undefined
    >()
    expectTypeOf<Update["id"]>().toEqualTypeOf<RecordIdentifier<"account">>()
    expectTypeOf<Update["etag"]>().toEqualTypeOf<Etag | undefined>()
    expectTypeOf<Update["externalId"]>().toEqualTypeOf<string | undefined>()
    expectTypeOf<Update["aliases"]>().toEqualTypeOf<
      RecordAliasUpdate | undefined
    >()
    expectTypeOf<Update["status"]>().toEqualTypeOf<
      "active" | "inactive" | undefined
    >()

    const decodeCreate = Schema.decodeUnknownSync(
      toEffectObjectCreateSchema(Account)
    )
    const decodeUpdate = Schema.decodeUnknownSync(
      toEffectObjectUpdateSchema(Account)
    )
    const hubspotAlias = RecordAlias("hubspot:portal_1:company:account_1")
    const salesforceAlias = RecordAlias("salesforce:org_1:account:account_1")

    expect(
      decodeCreate({
        aliases: [hubspotAlias],
        metadata: { source: "import" },
        externalId: "external_1",
        name: "Acme",
      })
    ).toEqual({
      aliases: [hubspotAlias],
      metadata: { source: "import" },
      externalId: "external_1",
      name: "Acme",
    })
    expect(() => decodeCreate({ externalId: "external_1" })).toThrow()
    expect(
      decodeCreate({
        externalId: "external_1",
        name: "Acme",
        unknown: "not accepted",
      })
    ).toEqual({
      externalId: "external_1",
      name: "Acme",
    })
    expect(decodeUpdate({ name: "Renamed" })).toEqual({ name: "Renamed" })
    expect(decodeUpdate({ email: null })).toEqual({ email: null })
    expect(() => decodeUpdate({ email: "" })).toThrow()
    expect(decodeUpdate({ metadata: {} })).toEqual({ metadata: {} })
    expect(decodeUpdate({ etag: "v1" })).toEqual({ etag: "v1" })
    expect(decodeUpdate({ aliases: [hubspotAlias] })).toEqual({
      aliases: [hubspotAlias],
    })
    expect(
      decodeUpdate({
        aliases: { add: [salesforceAlias], remove: [hubspotAlias] },
      })
    ).toEqual({
      aliases: { add: [salesforceAlias], remove: [hubspotAlias] },
    })
    expect(() =>
      decodeUpdate({ aliases: [hubspotAlias, hubspotAlias] })
    ).toThrow()
    expect(() =>
      decodeUpdate({
        aliases: { add: [hubspotAlias], remove: [hubspotAlias] },
      })
    ).toThrow()
    expect(decodeUpdate({ externalId: "external_1" })).toEqual({
      externalId: "external_1",
    })
    expect(decodeUpdate({})).toEqual({})

    const Membership = defineObject({
      id: "membership",
      collection: "memberships",
      name: "Membership",
      parent: Account,
      pluralName: "Memberships",
      properties: { role: schema.string() },
      display: { title: "role" },
    })
    type MembershipCreate = ObjectCreateInput<typeof Membership>
    const membership = {
      parent: AccountId("account_1"),
      role: "owner",
    } satisfies MembershipCreate
    expectTypeOf(membership.parent).toEqualTypeOf<RecordId<"account">>()
    expectTypeOf<MembershipCreate["parent"]>().toEqualTypeOf<
      RecordIdentifier<"account">
    >()
    const decodeMembership = Schema.decodeUnknownSync(
      toEffectObjectCreateSchema(Membership)
    )
    expect(decodeMembership(membership)).toEqual({
      parent: "account_1",
      role: "owner",
    })
    expect(decodeMembership({ parent: hubspotAlias, role: "owner" })).toEqual({
      parent: hubspotAlias,
      role: "owner",
    })
    expect(() => decodeMembership({ role: "owner" })).toThrow()
  })

  it("preserves action input inference while keeping Effect out of definitions", () => {
    const input = schema.object({
      account: schema.recordId(Account),
      notify: schema.optional(schema.boolean()),
    })
    type Input = InferSchema<typeof input>
    type InputBoundary = InferInputSchema<typeof input>

    expectTypeOf<Input>().toEqualTypeOf<{
      readonly account: RecordId<"account">
      readonly notify?: boolean
    }>()
    expectTypeOf<InputBoundary>().toEqualTypeOf<{
      readonly account: RecordIdentifier<"account">
      readonly notify?: boolean
    }>()

    const decode = Schema.decodeUnknownSync(toEffectSchema(input))
    expect(decode({ account: "account_1" })).toEqual({
      account: "account_1",
    })
    expect(() => decode({})).toThrow()

    const decodeInput = Schema.decodeUnknownSync(toEffectInputSchema(input))
    expect(
      decodeInput({ account: RecordAlias("hubspot:account:account_1") })
    ).toEqual({ account: "hubspot:account:account_1" })
  })

  it("validates semantic money values", () => {
    const decode = Schema.decodeUnknownSync(toEffectSchema(schema.money()))

    expect(decode({ amount: "1250.00", currency: "USD" })).toEqual({
      amount: "1250.00",
      currency: "USD",
    })
    expect(decode({ amount: "-1", currency: "USD" })).toEqual({
      amount: "-1",
      currency: "USD",
    })
    expect(() => decode({ amount: "01", currency: "USD" })).toThrow()
    expect(() => decode({ amount: "1", currency: "usd" })).toThrow()
  })

  it("validates portable file references without exposing delivery URLs", () => {
    const decode = Schema.decodeUnknownSync(toEffectSchema(schema.file()))

    expect(decode({ assetId: "asset_1" })).toEqual({ assetId: "asset_1" })
    expect(() => decode({ assetId: "" })).toThrow()
    expect(() => decode({ url: "https://example.com/file.pdf" })).toThrow()
  })

  it("validates decimals, geographic points, and media references", () => {
    const decodeDecimal = Schema.decodeUnknownSync(
      toEffectSchema(schema.decimal({ precision: 5, scale: 2 }))
    )
    const decodePoint = Schema.decodeUnknownSync(
      toEffectSchema(schema.geoPoint())
    )
    const decodeMedia = Schema.decodeUnknownSync(toEffectSchema(schema.media()))

    expect(decodeDecimal("123.45")).toBe("123.45")
    expect(() => decodeDecimal("1234.56")).toThrow()
    expect(() => decodeDecimal("1.234")).toThrow()
    expect(decodePoint({ latitude: 37.7749, longitude: -122.4194 })).toEqual({
      latitude: 37.7749,
      longitude: -122.4194,
    })
    expect(() => decodePoint({ latitude: 91, longitude: 0 })).toThrow()
    expect(decodeMedia({ assetId: "asset_1", alt: "Demo recording" })).toEqual({
      assetId: "asset_1",
      alt: "Demo recording",
    })
    expect(() => decodeMedia({ assetId: "" })).toThrow()
  })
})
