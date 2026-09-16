import { Contact } from "#/modules/crm/model/contact.ts"
import { defineController } from "#/runtime/model/index.ts"

export const ContactSummary = defineController({
  id: "contact-summary",
  name: "Contact summary",
  description:
    "Uses an agent to keep each contact's summary current from notes, affiliations, activities, and public sources.",
  record: Contact,
  ignoreUpdates: ["summary"],
  minInterval: "2 seconds",
  watch: [
    "notes",
    "affiliations",
    "affiliations.notes",
    "affiliations.account",
    "affiliations.account.notes",
    "activities",
    "activities.notes",
  ],
})
