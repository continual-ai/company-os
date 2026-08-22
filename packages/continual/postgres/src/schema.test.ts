import {
  Root,
  defineLink,
  defineModel,
  defineObject,
  schema,
} from "@continual/runtime"
import { getTableColumns, getTableName } from "drizzle-orm"
import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"

import { makePostgresSchema } from "./schema"

describe("makePostgresSchema", () => {
  it("projects many-to-many links through one generated junction table", () => {
    const Person = defineObject({
      id: "person",
      collection: "people",
      name: "Person",
      parent: Root,
      pluralName: "People",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const Team = defineObject({
      id: "team",
      collection: "teams",
      name: "Team",
      parent: Root,
      pluralName: "Teams",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const TeamMembership = defineLink({
      id: "teamMembership",
      name: "Team membership",
      from: {
        type: Person,
        key: "teams",
        cardinality: "many",
        label: "Teams",
      },
      to: {
        type: Team,
        key: "members",
        cardinality: "many",
        label: "Members",
      },
    })
    const model = defineModel({
      id: "test",
      name: "Test",
      objects: [Person, Team],
      links: [TeamMembership],
    })

    const storage = makePostgresSchema(model)

    expect(getTableName(storage.linkTables.teamMembership)).toBe(
      "team_membership"
    )
    expect(
      Object.keys(getTableColumns(storage.linkTables.teamMembership))
    ).toEqual(["teamsId", "membersId"])
    expect(storage.relations.person?.relations.teams?.targetTableName).toBe(
      "team"
    )
    expect(storage.relations.team?.relations.members?.targetTableName).toBe(
      "person"
    )
  })

  it("rejects physical table-name collisions after normalization", () => {
    const Collision = defineObject({
      id: "collision",
      collection: "objects",
      name: "Collision",
      parent: Root,
      pluralName: "Collisions",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const model = defineModel({
      id: "test",
      name: "Test",
      objects: [Collision],
      links: [],
    })

    expect(() => makePostgresSchema(model)).toThrow(
      /table 'objects' is required by both core objects and object 'collision'/
    )
  })

  it("keeps portable property validation out of the storage schema", () => {
    const ValidatedRecord = defineObject({
      id: "validatedRecord",
      collection: "validatedRecords",
      name: "Validated record",
      parent: Root,
      pluralName: "Validated records",
      properties: {
        count: schema.number({ maximum: 10, minimum: 1 }),
        name: schema.string({ maxLength: 100, minLength: 1 }),
        status: schema.select({
          options: [
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
          ],
        }),
      },
      display: { title: "name" },
    })
    const model = defineModel({
      id: "test",
      name: "Test",
      objects: [ValidatedRecord],
      links: [],
    })

    const storage = makePostgresSchema(model)

    expect(getTableConfig(storage.objects.validatedRecord).checks).toEqual([])
    expect(
      getTableConfig(storage.core.objects).checks.map(({ name }) => name)
    ).toEqual(["objects_object_type_check", "objects_parent_required"])
    expect(
      getTableConfig(storage.core.objectAliases).checks.map(({ name }) => name)
    ).toEqual(["object_aliases_alias_length_check"])
  })
})
