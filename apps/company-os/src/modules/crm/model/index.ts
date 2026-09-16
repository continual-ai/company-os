import { Account, AccountOwner } from "#/modules/crm/model/account.ts"
import {
  Activity,
  ActivityAccounts,
  ActivityContacts,
  ActivityOwner,
} from "#/modules/crm/model/activity.ts"
import {
  Affiliation,
  AffiliationContact,
  AffiliationAccount,
} from "#/modules/crm/model/affiliation.ts"
import { ContactSummary } from "#/modules/crm/model/contact-summary.ts"
import { Contact } from "#/modules/crm/model/contact.ts"
import { Party } from "#/modules/crm/model/interfaces/party.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const CrmModule = defineModule({
  id: "crm",
  name: "CRM",
  description:
    "Shared accounts, contacts, and activities across sales, marketing, and service.",
  maturity: "alpha",
  objects: [Account, Contact, Activity, Affiliation],
  interfaces: [Party],
  controllers: [ContactSummary],
  links: [
    AccountOwner,
    AffiliationContact,
    AffiliationAccount,
    ActivityAccounts,
    ActivityContacts,
    ActivityOwner,
  ],
})

export { Account, Contact, Activity, Affiliation, Party }
