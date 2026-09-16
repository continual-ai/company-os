import { expect, expectTypeOf, it } from "vitest"

import { defineLink } from "#/runtime/model/definition/link.ts"
import { defineModel } from "#/runtime/model/definition/model.ts"
import { defineModule } from "#/runtime/model/definition/module.ts"
import { defineObject } from "#/runtime/model/definition/object.ts"
import { schema } from "#/runtime/model/definition/schema.ts"

const Contact = defineObject({
  id: "contact",
  collection: "contacts",
  name: "Contact",
  pluralName: "Contacts",
  properties: { name: schema.string() },
  display: { title: "name" },
})

it("keeps object inference closed when composing a link-only module", () => {
  const contacts = defineModule({
    id: "contacts",
    name: "Contacts",
    objects: [Contact],
  })
  const referrals = defineModule({
    id: "referrals",
    name: "Referrals",
    links: [
      defineLink({
        id: "contactReferrals",
        name: "Contact referrals",
        from: { object: Contact, key: "referrals", label: "Referrals" },
        to: { object: Contact, key: "referrers", label: "Referrers" },
      }),
    ],
  })
  const model = defineModel({
    name: "Contacts",
    modules: [contacts, referrals],
  })
  expectTypeOf(referrals.objects).toEqualTypeOf<readonly []>()
  expectTypeOf<keyof typeof model.objects>().toEqualTypeOf<"contact">()
  expect(Object.keys(model.objects)).toEqual(["contact"])
  expect(model.links.contactReferrals).toBeDefined()
})
