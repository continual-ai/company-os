import { Effect } from "effect"

import { Group, GroupMembership } from "#/runtime/access/model/index.ts"
import { UserService } from "#/runtime/access/server/user-service.ts"
import { EmailAddress } from "#/runtime/model/index.ts"
import { Records } from "#/runtime/server/index.ts"

export const seedDevelopmentTeam = Effect.fn("@company/seedDevelopmentTeam")(
  function* () {
    const users = yield* UserService
    const records = yield* Records
    const teams = [
      {
        name: "Customer operations",
        people: ["Isabel Torres", "Marcus Reed", "Hana Suzuki", "Owen Price"],
      },
      {
        name: "Engineering",
        people: ["Priya Nair", "Felix Weber", "Camille Laurent", "Daniel Park"],
      },
      {
        name: "Growth",
        people: ["Nadia Hassan", "Lucas Silva", "Grace Wang", "Amara Diallo"],
      },
    ]
    const owners = []
    for (const team of teams) {
      const group = yield* records.writer(Group).create({
        name: team.name,
        description: `${team.name} team in the fictional development company.`,
      })
      for (const name of team.people) {
        const user = yield* users.provision({
          name,
          email: EmailAddress(
            `${name.toLowerCase().replaceAll(" ", ".")}@team.example.test`
          ),
        })
        owners.push(user.id)
        yield* records
          .writer(GroupMembership)
          .create({ parent: group.id, member: user.id })
      }
    }
    return owners
  }
)
