import { defineModule } from "@company/runtime"

import { Company } from "./company"
import { Contact } from "./contact"
import { ContactPrimaryCompany } from "./contact-primary-company"
import { Deal } from "./deal"
import { Lead } from "./lead"
import { LineItem } from "./line-item"
import { Note } from "./note"
import { NoteSubject } from "./note-subject"
import { NoteSubjects } from "./note-subjects"
import { Party } from "./party"

export const SalesModule = defineModule({
  id: "sales",
  name: "Sales",
  interfaces: [Party, NoteSubject],
  links: [ContactPrimaryCompany, NoteSubjects],
  objects: [Company, Contact, Lead, Deal, LineItem, Note],
})
