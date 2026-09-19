import { Effect } from "effect"
import { expect } from "vitest"

import {
  defineInterface,
  defineLink,
  defineModel,
  defineModule,
  defineObject,
  schema,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { operationsFor } from "#/runtime/server/operation-executor.ts"
import { FixtureModule, Person } from "#/runtime/testing/fixture-model.ts"
import { FixtureServer } from "#/runtime/testing/fixture-server.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const Holder = defineInterface({
  id: "holder",
  name: "Holder",
  pluralName: "Holders",
})
const Badge = defineObject({
  id: "badge",
  collection: "badges",
  name: "Badge",
  pluralName: "Badges",
  implements: [{ interface: Holder }],
  properties: { code: schema.string() },
  display: { title: ["person.name"] },
  search: { fields: ["code"] },
})
// Required reverse end owns the reference, including when declared on an interface.
const PersonBadge = defineLink({
  id: "personBadge",
  from: { object: Person, key: "badge", max: 1 },
  to: { object: Holder, key: "person", min: 1, max: 1 },
})
const model = defineModel({
  name: "Required interface references",
  modules: [
    PlatformModule,
    FixtureModule,
    defineModule({
      id: "badges",
      name: "Badges",
      interfaces: [Holder],
      objects: [Badge],
      links: [PersonBadge],
    }),
  ],
})
const fixture = testFoundation(model, { servers: [FixtureServer] })

fixture.test(
  "creates and replaces required interface references, updating inverse reads and search",
  () =>
    Effect.gen(function* () {
      const services = yield* operationsFor(model)
      const first = yield* services.person.create({ name: "Alexandra" })
      const second = yield* services.person.create({ name: "Beatrice" })
      const badge = yield* services.badge.create({
        code: "A",
        links: { person: first.id },
      })
      expect(badge.label).toBe("Alexandra")
      expect(badge.links.person).toBe(first.id)
      expect((yield* services.person.get({ id: first.id })).links.badge).toBe(
        badge.id
      )
      const replaced = yield* services.badge.update({
        id: badge.id,
        links: { person: second.id },
      })
      expect(replaced.label).toBe("Beatrice")
      expect(
        (yield* services.person.get({ id: first.id })).links.badge
      ).toBeNull()
      expect((yield* services.person.get({ id: second.id })).links.badge).toBe(
        badge.id
      )
      expect(
        (yield* services.badge.list({ query: "Beatrice" })).items.map(
          (item) => item.id
        )
      ).toEqual([badge.id])
      expect(
        (yield* services.badge.list({ query: "Alexandra" })).items
      ).toEqual([])
    })
)
