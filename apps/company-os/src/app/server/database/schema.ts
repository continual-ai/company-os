import { Model } from "#/app.model.ts"
import { makePostgresSchema } from "#/runtime/server/postgres/index.ts"
import { makeSchemaSql } from "#/runtime/server/schema.ts"

/** Physical storage projection of the composed model. */
export const Storage = makePostgresSchema(Model)
export const schemaSql = makeSchemaSql(Model)

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
