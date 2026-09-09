import { Principal } from "#/runtime/access/model/interfaces/principal.ts"
import { defineObject, schema } from "#/runtime/model/index.ts"

export const PrincipalSet = defineObject({
  id: "principalSet",
  collection: "principalSets",
  name: "Principal set",
  pluralName: "Principal sets",
  description: "A built-in audience, such as everyone or signed-in users.",
  actions: { create: false, delete: false, update: false },
  implements: [{ interface: Principal }],
  properties: {
    kind: schema.select({
      label: "Kind",
      immutable: true,
      options: [
        { value: "allCallers", label: "All callers" },
        {
          value: "allAuthenticatedCallers",
          label: "All authenticated callers",
        },
      ],
    }),
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    description: schema.string({
      label: "Description",
      maxLength: 2_000,
      nullable: true,
    }),
  },
  uniqueBy: { kind: ["kind"] },
  display: { icon: "users", subtitle: "description", title: "name" },
})
