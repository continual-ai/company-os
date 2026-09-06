import { defineModule } from "@company/runtime"

import { Activity } from "./activity/model"
import { Company } from "./company/model"
import { Contact } from "./contact/model"
import { Deal } from "./deal/model"
import { NoteSubject } from "./interfaces/note-subject"
import { Party } from "./interfaces/party"
import { Lead } from "./lead/model"
import { LineItem } from "./line-item/model"
import { ContactCompanies } from "./links/contact-companies"
import { ContactPrimaryCompany } from "./links/contact-primary-company"
import { DealCompanies } from "./links/deal-companies"
import { NoteSubjects } from "./links/note-subjects"
import { Note } from "./note/model"

export const SalesModule = defineModule({
  id: "sales",
  name: "Sales",
  interfaces: [Party, NoteSubject],
  links: [ContactCompanies, ContactPrimaryCompany, DealCompanies, NoteSubjects],
  objects: [Activity, Company, Contact, Lead, Deal, LineItem, Note],
})
