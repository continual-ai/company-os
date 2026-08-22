import {
  Root,
  defineLink,
  defineModel,
  defineObject,
  schema,
} from "@continual/runtime"
import { getTableColumns, getTableName } from "drizzle-orm"
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
})
