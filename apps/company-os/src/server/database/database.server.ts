import * as PgDrizzle from "drizzle-orm/effect-postgres"
import { Context, Layer } from "effect"

import { relations } from "./schema.server"

const make = PgDrizzle.makeWithDefaults({ relations })

/** The application's typed database, backed by the configured Effect PostgreSQL client. */
export class Database extends Context.Service<Database>()("@company/Database", {
  make,
}) {
  static readonly layer = Layer.effect(this, this.make)
}
