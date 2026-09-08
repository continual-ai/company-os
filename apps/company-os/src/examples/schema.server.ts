import {
  applySchemaMigrations,
  schemaHash,
} from "@company/runtime/server/migrations"
import { makePostgresSchema } from "@company/runtime/server/postgres"

import { Model } from "#/examples/model.ts"
export const Storage = makePostgresSchema(Model)
export const objects = Storage.core.objects
export const recordAliases = Storage.core.recordAliases
export const actors = Storage.interfaces.actor
export const authorizationScopes = Storage.interfaces.authorizationScope
export const identities = Storage.interfaces.identity
export const parties = Storage.interfaces.party
export const principals = Storage.interfaces.principal
export const principalSets = Storage.objects.principalSet
export const anonymousActors = Storage.objects.anonymousActor
export const companies = Storage.objects.company
export const groupMemberships = Storage.objects.groupMembership
export const groups = Storage.objects.group
export const leads = Storage.objects.lead
export const lineItems = Storage.objects.lineItem
export const notes = Storage.objects.note
export const roleAssignments = Storage.objects.roleAssignment
export const roles = Storage.objects.role
export const users = Storage.objects.user

import { makeSchemaSql } from "@company/runtime/server/schema"
export const schemaSql = makeSchemaSql(Model)

export const applyMigrations = () =>
  applySchemaMigrations(
    [
      {
        id: 1,
        name: "example",
        sql:
          schemaSql +
          "\ninsert into event_journal_state (id, position) values (1, 0);",
        schemaHash: schemaHash(schemaSql),
      },
    ],
    schemaHash(schemaSql)
  )
