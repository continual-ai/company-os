import { AcmeModel } from "@acme/api"
import { makePostgresSchema } from "@continual/postgres"

export const AcmeStorage = makePostgresSchema(AcmeModel)

// Drizzle Kit currently discovers top-level exported table instances. These
// aliases expose the generated projection without duplicating its definition.
export const objects = AcmeStorage.core.objects
export const recordAliases = AcmeStorage.core.recordAliases
export const platforms = AcmeStorage.core.roots
export const authorizationScopes = AcmeStorage.interfaces.authorizationScope
export const identities = AcmeStorage.interfaces.identity
export const parties = AcmeStorage.interfaces.party
export const principals = AcmeStorage.interfaces.principal
export const companies = AcmeStorage.objects.company
export const contacts = AcmeStorage.objects.contact
export const deals = AcmeStorage.objects.deal
export const groupMemberships = AcmeStorage.objects.groupMembership
export const groups = AcmeStorage.objects.group
export const interactions = AcmeStorage.objects.interaction
export const leads = AcmeStorage.objects.lead
export const lineItems = AcmeStorage.objects.lineItem
export const roleAssignments = AcmeStorage.objects.roleAssignment
export const roles = AcmeStorage.objects.role
export const serviceAccounts = AcmeStorage.objects.serviceAccount
export const users = AcmeStorage.objects.user
export const relations = AcmeStorage.relations
