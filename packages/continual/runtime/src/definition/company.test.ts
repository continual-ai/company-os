import { describe, expect, expectTypeOf, it } from "vitest"

import { defineAction } from "./action"
import { defineCompany } from "./company"
import { defineError } from "./error"
import { field } from "./field"
import { defineModule } from "./module"
import { defineObject, type DefinedObject } from "./object"
import { schema } from "./schema"

const Contact = defineObject({
  id: "contact",
  collection: "contacts",
  name: "Contact",
  pluralName: "Contacts",
  fields: {
    name: field.text({ required: true }),
  },
  display: { title: "name" },
})

function action(id: string, method: string, subject: DefinedObject = Contact) {
  return defineAction({
    id,
    verb: method,
    name: id,
    subject,
    input: schema.object({ contactId: schema.recordId(subject) }),
    output: schema.object({ contactId: schema.recordId(subject) }),
    errors: [
      defineError({
        code: "failed",
        category: "unknown",
        name: "Failed",
        details: schema.object({}),
      }),
    ],
  })
}

describe("company-wide registration", () => {
  it("rejects duplicate module identities", () => {
    const CRM = defineModule({
      id: "crm",
      name: "CRM",
      objects: [Contact],
    })
    const DuplicateCRM = defineModule({
      id: "crm",
      name: "Duplicate CRM",
      objects: [],
    })

    expect(() =>
      defineCompany({
        id: "acme",
        name: "Acme",
        modules: [CRM, DuplicateCRM],
      })
    ).toThrow(/Module id 'crm'/)
  })

  it("allows actions to target objects from another module", () => {
    const CRM = defineModule({
      id: "crm",
      name: "CRM",
      objects: [Contact],
    })
    const Marketing = defineModule({
      id: "marketing",
      name: "Marketing",
      objects: [],
      actions: [action("enrollContact", "enroll")],
    })

    expect(() =>
      defineCompany({ id: "acme", name: "Acme", modules: [CRM, Marketing] })
    ).not.toThrow()
  })

  it("rejects action subjects that are absent from the company", () => {
    const ExternalContact = defineObject({
      id: "externalContact",
      collection: "externalContacts",
      name: "External contact",
      pluralName: "External contacts",
      fields: { name: field.text({ required: true }) },
      display: { title: "name" },
    })
    const Marketing = defineModule({
      id: "marketing",
      name: "Marketing",
      objects: [],
      actions: [action("enrollExternalContact", "enroll", ExternalContact)],
    })

    expect(() =>
      defineCompany({ id: "acme", name: "Acme", modules: [Marketing] })
    ).toThrow(/not registered in company/)
  })

  it("rejects duplicate client methods across modules", () => {
    const CRM = defineModule({
      id: "crm",
      name: "CRM",
      objects: [Contact],
      actions: [action("firstEnrollment", "enroll")],
    })
    const Marketing = defineModule({
      id: "marketing",
      name: "Marketing",
      objects: [],
      actions: [action("secondEnrollment", "enroll")],
    })

    expect(() =>
      defineCompany({ id: "acme", name: "Acme", modules: [CRM, Marketing] })
    ).toThrow(/contact\.enroll/)
  })

  it("reserves conventional object methods for standard operations", () => {
    const CRM = defineModule({
      id: "crm",
      name: "CRM",
      objects: [Contact],
      actions: [action("customCreate", "create")],
    })

    expect(() =>
      defineCompany({ id: "acme", name: "Acme", modules: [CRM] })
    ).toThrow(/reserved object method 'create'/)
  })
})

describe("object conventions", () => {
  it("normalizes zero values and explicit nullability", () => {
    expect(field.text()).toMatchObject({
      defaultValue: "",
      nullable: false,
      required: false,
    })
    expect(field.email()).toMatchObject({
      defaultValue: "",
      nullable: false,
    })
    expect(field.number()).toMatchObject({
      defaultValue: 0,
      nullable: false,
    })
    expect(field.date({ nullable: true })).toMatchObject({
      nullable: true,
      required: false,
    })
  })

  it("rejects contradictory field behaviors", () => {
    expect(() => field.text({ outputOnly: true, required: true })).toThrow(
      /cannot be required as input/
    )
    expect(() =>
      field.text({ defaultValue: "generated", required: true })
    ).toThrow(/both required input and server-defaulted/)
    expect(() => field.image({ nullable: true, required: true })).toThrow(
      /required field cannot be nullable/
    )
    expect(() =>
      field.select({
        defaultValue: "active",
        nullable: true,
        options: [{ value: "active", label: "Active" }],
      })
    ).toThrow(/defaulted field cannot be nullable/)
    expect(() => field.date({})).toThrow(/has no zero value/)
    expect(() => field.number({ minimum: 1 })).toThrow(/has no zero value/)
    expect(() => field.number({ defaultValue: 0, minimum: 1 })).toThrow(
      /default must satisfy its range/
    )
    expect(() => schema.email({ minLength: 2, maxLength: 1 })).toThrow(
      /minimum cannot be greater/
    )
  })

  it("enables standard operations by default and preserves explicit opt-outs", () => {
    const ReadOnlyContact = defineObject({
      id: "readOnlyContact",
      collection: "readOnlyContacts",
      name: "Read-only contact",
      pluralName: "Read-only contacts",
      fields: { name: field.text({ required: true }) },
      operations: { create: false, update: false, delete: false },
      display: { title: "name" },
    })

    expect(Contact.operations).toEqual({
      batchGet: true,
      create: true,
      get: true,
      list: true,
      update: true,
      delete: true,
    })
    expect(ReadOnlyContact.operations).toEqual({
      batchGet: true,
      create: false,
      get: true,
      list: true,
      update: false,
      delete: false,
    })
    expectTypeOf(ReadOnlyContact.operations.create).toEqualTypeOf<false>()
    expectTypeOf(ReadOnlyContact.operations.get).toEqualTypeOf<true>()
  })

  it("reserves base record field names", () => {
    expect(() =>
      defineObject({
        id: "invalidContact",
        collection: "invalidContacts",
        name: "Invalid contact",
        pluralName: "Invalid contacts",
        fields: { createdAt: field.date({ required: true }) },
        display: { title: "createdAt" },
      })
    ).toThrow(/cannot redefine base record field 'createdAt'/)
  })
})

describe("action conventions", () => {
  it("rejects duplicate declared error codes", () => {
    const Failed = defineError({
      code: "failed",
      category: "unknown",
      name: "Failed",
      details: schema.object({}),
    })

    expect(() =>
      defineAction({
        id: "duplicateErrors",
        verb: "fail",
        name: "Duplicate errors",
        subject: Contact,
        input: schema.object({}),
        output: schema.object({}),
        errors: [Failed, Failed],
      })
    ).toThrow(/declares error 'failed' more than once/)
  })
})
