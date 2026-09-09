import { TestDatabase } from "#/runtime/server/storage/testing.ts"

/** Fails the database project once, with the configuration message, instead of in every file. */
export default async function setup() {
  await TestDatabase.drop(await TestDatabase.createTemplate(""))
}
