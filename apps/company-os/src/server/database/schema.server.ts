import { Model } from "@company/model"
import { makePostgresSchema } from "@company/postgres"

export const Storage = makePostgresSchema(Model)

// Drizzle Kit currently discovers top-level exported table instances. These
// aliases expose the generated projection without duplicating its definition.
export const objects = Storage.core.objects
export const recordAliases = Storage.core.recordAliases
export const platforms = Storage.core.roots
export const authorizationScopes = Storage.interfaces.authorizationScope
export const identities = Storage.interfaces.identity
export const parties = Storage.interfaces.party
export const principals = Storage.interfaces.principal
export const companies = Storage.objects.company
export const contacts = Storage.objects.contact
export const deals = Storage.objects.deal
export const groupMemberships = Storage.objects.groupMembership
export const groups = Storage.objects.group
export const interactions = Storage.objects.interaction
export const leads = Storage.objects.lead
export const lineItems = Storage.objects.lineItem
export const roleAssignments = Storage.objects.roleAssignment
export const roles = Storage.objects.role
export const serviceAccounts = Storage.objects.serviceAccount
export const users = Storage.objects.user
export const relations = Storage.relations
