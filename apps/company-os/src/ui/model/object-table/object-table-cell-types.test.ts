import { schema } from "@company/runtime"
import { describe, expect, it } from "vitest"

import {
  isObjectTableCellEditable,
  objectTableCellBehavior,
  objectTableCellShouldExpand,
  objectTableCellType,
  objectTableLinkHref,
  objectTableUrlDisplayValue,
  parseObjectTableCellInput,
} from "./object-table-cell-types"

describe("objectTableLinkHref", () => {
  it("builds links only for URL values", () => {
    expect(objectTableLinkHref("url", "https://northwind.example/about")).toBe(
      "https://northwind.example/about"
    )
    expect(objectTableLinkHref("domain", "northwind.example")).toBeNull()
    expect(objectTableLinkHref("email", "hello@northwind.example")).toBeNull()
    expect(objectTableLinkHref("phone", "+1 415 555 0100")).toBeNull()
  })

  it("rejects unsafe URL protocols and non-link cell types", () => {
    expect(objectTableLinkHref("url", "javascript:alert(1)")).toBeNull()
    expect(objectTableLinkHref("text", "northwind.example")).toBeNull()
    expect(objectTableLinkHref("url", "not a URL")).toBeNull()
  })

  it("uses compact URL display text without changing the href", () => {
    expect(
      objectTableUrlDisplayValue(
        "https://www.northwind.example/about?region=us"
      )
    ).toBe("www.northwind.example/about?region=us")
  })

  it("adapts arrays of strings and enums to tag cells", () => {
    const propertyMetadata = {
      immutable: false,
      nullable: false,
      outputOnly: false,
      requiredOnCreate: true,
    } as const

    expect(
      objectTableCellType({
        ...schema.array(schema.string()),
        ...propertyMetadata,
      })
    ).toBe("tags")
    expect(
      objectTableCellType({
        ...schema.array(
          schema.select({
            options: [
              { label: "B2B", value: "b2b" },
              { label: "B2C", value: "b2c" },
            ],
          })
        ),
        ...propertyMetadata,
      })
    ).toBe("tags")
  })

  it("normalizes semantic schemas to named cell adapters", () => {
    const propertyMetadata = {
      immutable: false,
      nullable: false,
      outputOnly: false,
      requiredOnCreate: true,
    } as const

    expect(
      objectTableCellType({ ...schema.image(), ...propertyMetadata })
    ).toBe("image")
    expect(
      objectTableCellType({ ...schema.number(), ...propertyMetadata })
    ).toBe("number")
    expect(objectTableCellType({ ...schema.date(), ...propertyMetadata })).toBe(
      "date"
    )
    expect(
      objectTableCellType({ ...schema.timestamp(), ...propertyMetadata })
    ).toBe("timestamp")
    expect(
      objectTableCellType({ ...schema.boolean(), ...propertyMetadata })
    ).toBe("boolean")
  })

  it("keeps edit and overflow policy in the behavior registry", () => {
    const propertyMetadata = {
      immutable: false,
      nullable: false,
      outputOnly: false,
      requiredOnCreate: true,
    } as const
    const editableText = {
      ...schema.string({ label: "Description" }),
      ...propertyMetadata,
    }
    const tags = {
      ...schema.array(schema.string(), { label: "Categories" }),
      ...propertyMetadata,
    }
    const image = {
      ...schema.image({ label: "Logo" }),
      ...propertyMetadata,
    }

    expect(objectTableCellBehavior(editableText)).toMatchObject({
      editable: true,
      filterFamily: "text",
      overflow: "expandLongText",
    })
    expect(isObjectTableCellEditable(image)).toBe(false)
    expect(
      objectTableCellShouldExpand(tags, {
        displayLength: 15,
        valueCount: 2,
      })
    ).toBe(false)
    expect(
      objectTableCellShouldExpand(tags, {
        displayLength: 36,
        valueCount: 4,
      })
    ).toBe(true)
    expect(
      objectTableCellShouldExpand(editableText, {
        displayLength: 66,
        valueCount: 0,
      })
    ).toBe(true)
    expect(
      objectTableCellShouldExpand(image, {
        displayLength: 4,
        valueCount: 0,
      })
    ).toBe(false)
  })

  it("validates and normalizes typed cell input", () => {
    const propertyMetadata = {
      immutable: false,
      nullable: true,
      outputOnly: false,
      requiredOnCreate: false,
    } as const

    expect(
      parseObjectTableCellInput(
        { ...schema.email(), ...propertyMetadata },
        " Sales@Example.COM "
      )
    ).toEqual({ value: "sales@example.com" })
    expect(
      parseObjectTableCellInput(
        { ...schema.phone(), ...propertyMetadata },
        "(206) 555-0142"
      )
    ).toEqual({ value: "+1 206 555 0142" })
    expect(
      parseObjectTableCellInput(
        { ...schema.phone(), ...propertyMetadata },
        "23433423"
      )
    ).toHaveProperty("error")
    expect(
      parseObjectTableCellInput(
        {
          ...schema.number({ integer: true, minimum: 0 }),
          ...propertyMetadata,
        },
        "1.5"
      )
    ).toEqual({ error: "Enter a whole number." })
  })
})
