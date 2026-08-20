import { Schema } from "effect"
import { describe, expect, expectTypeOf, it } from "vitest"

import {
  defineObject,
  type ObjectCreateInput,
  type ObjectRecord,
  type ObjectUpdateInput,
} from "./definition/object"
import { Root } from "./definition/root"
import {
  RecordId,
  schema,
  type EmailAddress,
  type InferSchema,
} from "./definition/schema"
import {
  toEffectObjectCreateSchema,
  toEffectObjectSchema,
  toEffectObjectUpdateSchema,
  toEffectSchema,
} from "./effect-schema"

const AccountId = RecordId("account")

const Account = defineObject({
  id: "account",
  collection: "accounts",
  name: "Account",
  parent: Root,
  pluralName: "Accounts",
  properties: {
    logo: schema.image({ aspectRatio: 1, nullable: true }),
    externalId: schema.string({ immutable: true, required: true }),
    name: schema.string({ required: true, minLength: 1 }),
    email: schema.email(),
    searchLabel: schema.string({ outputOnly: true }),
    status: schema.select({
      defaultValue: "active",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    }),
  },
  display: { title: "name", status: "status" },
})

describe("Effect Schema projection", () => {
  it("decodes records from portable object definitions", () => {
    const decode = Schema.decodeUnknownSync(toEffectObjectSchema(Account))
    const base = {
      annotations: {},
      id: "account_1",
      createdAt: "2026-08-18T12:00:00Z",
      createdById: "user_1",
      etag: "v1",
      parentId: "root_1",
      updatedAt: "2026-08-18T13:00:00.123Z",
      updatedById: "user_1",
    }

    expect(
      decode({
        ...base,
        email: "",
        externalId: "external_1",
        logo: { assetId: "asset_1", alt: "Acme logo" },
        name: "Acme",
        searchLabel: "Acme search",
        status: "active",
      })
    ).toEqual({
      ...base,
      email: "",
      externalId: "external_1",
      logo: { assetId: "asset_1", alt: "Acme logo" },
      name: "Acme",
      searchLabel: "Acme search",
      status: "active",
    })
    expect(() =>
      decode({
        ...base,
        email: "",
        externalId: "external_1",
        logo: null,
        name: "",
        searchLabel: "",
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
        searchLabel: "",
        status: "active",
      })
    ).toThrow()
    expect(() =>
      decode({
        ...base,
        externalId: "external_1",
        logo: { assetId: "" },
        email: "",
        name: "Acme",
        searchLabel: "",
        status: "active",
      })
    ).toThrow()
    expect(() =>
      decode({
        ...base,
        externalId: "external_1",
        createdAt: "yesterday",
        email: "",
        logo: null,
        name: "Acme",
        searchLabel: "",
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
    const typedUpdate = { logo: null } satisfies Update
    expect(typedCreate.logo.assetId).toBe("asset_1")
    expect(typedUpdate.logo).toBeNull()

    expectTypeOf<AccountRecord["email"]>().toEqualTypeOf<EmailAddress | "">()
    expectTypeOf<AccountRecord["logo"]>().toEqualTypeOf<{
      assetId: string
      alt?: string
    } | null>()
    expectTypeOf<Create["email"]>().toEqualTypeOf<
      EmailAddress | "" | undefined
    >()
    expectTypeOf<Create["status"]>().toEqualTypeOf<
      "active" | "inactive" | undefined
    >()
    expectTypeOf<AccountRecord["status"]>().toEqualTypeOf<
      "active" | "inactive"
    >()
    expectTypeOf<Create["annotations"]>().toEqualTypeOf<
      Readonly<Record<string, string>> | undefined
    >()
    expectTypeOf<Create["parentId"]>().toEqualTypeOf<undefined>()
    expectTypeOf<AccountRecord["parentId"]>().toEqualTypeOf<RecordId<"root">>()
    expectTypeOf<Update["email"]>().toEqualTypeOf<
      EmailAddress | "" | undefined
    >()
    expectTypeOf<Update["externalId"]>().toEqualTypeOf<string | undefined>()
    expectTypeOf<Update["status"]>().toEqualTypeOf<
      "active" | "inactive" | undefined
    >()

    const decodeCreate = Schema.decodeUnknownSync(
      toEffectObjectCreateSchema(Account)
    )
    const decodeUpdate = Schema.decodeUnknownSync(
      toEffectObjectUpdateSchema(Account)
    )

    expect(
      decodeCreate({
        annotations: { source: "import" },
        externalId: "external_1",
        name: "Acme",
      })
    ).toEqual({
      annotations: { source: "import" },
      externalId: "external_1",
      name: "Acme",
    })
    expect(() => decodeCreate({ externalId: "external_1" })).toThrow()
    expect(
      decodeCreate({
        externalId: "external_1",
        name: "Acme",
        searchLabel: "not accepted",
      })
    ).toEqual({
      externalId: "external_1",
      name: "Acme",
    })
    expect(decodeUpdate({ name: "Renamed" })).toEqual({ name: "Renamed" })
    expect(decodeUpdate({ email: "" })).toEqual({ email: "" })
    expect(() => decodeUpdate({ email: null })).toThrow()
    expect(decodeUpdate({ annotations: {} })).toEqual({ annotations: {} })
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
      properties: { role: schema.string({ required: true }) },
      display: { title: "role" },
    })
    type MembershipCreate = ObjectCreateInput<typeof Membership>
    const membership = {
      parentId: AccountId("account_1"),
      role: "owner",
    } satisfies MembershipCreate
    expectTypeOf(membership.parentId).toEqualTypeOf<RecordId<"account">>()
    const decodeMembership = Schema.decodeUnknownSync(
      toEffectObjectCreateSchema(Membership)
    )
    expect(decodeMembership(membership)).toEqual({
      parentId: "account_1",
      role: "owner",
    })
    expect(() => decodeMembership({ role: "owner" })).toThrow()
  })

  it("preserves action input inference while keeping Effect out of definitions", () => {
    const input = schema.object({
      accountId: schema.recordId(Account),
      notify: schema.optional(schema.boolean()),
    })
    type Input = InferSchema<typeof input>

    expectTypeOf<Input>().toEqualTypeOf<{
      readonly accountId: RecordId<"account">
      readonly notify?: boolean
    }>()

    const decode = Schema.decodeUnknownSync(toEffectSchema(input))
    expect(decode({ accountId: "account_1" })).toEqual({
      accountId: "account_1",
    })
    expect(() => decode({})).toThrow()
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
})
