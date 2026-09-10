import { Effect } from "effect"

import { UserService } from "#/runtime/access/server/user-service.ts"
import { EmailAddress } from "#/runtime/model/index.ts"

export const seedDevelopmentTeam = Effect.fn("@company/seedDevelopmentTeam")(
  function* () {
    const users = yield* UserService
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
      for (const name of team.people) {
        const user = yield* users.provision({
          name,
          email: EmailAddress(
            `${name.toLowerCase().replaceAll(" ", ".")}@team.example.test`
          ),
        })
        owners.push(user.id)
      }
    }
    return owners
  }
)
