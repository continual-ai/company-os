import { NoteSubject } from "#/modules/notes/model/index.ts"
import { defineObject, schema } from "#/runtime/model/index.ts"

export const Candidate = defineObject({
  id: "candidate",
  collection: "candidates",
  name: "Candidate",
  pluralName: "Candidates",
  description: "A person who may apply for one or more roles.",
  implements: [{ interface: NoteSubject }],
  uniqueBy: { email: ["email"] },
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 300 }),
    email: schema.email({ label: "Email", maxLength: 320 }),
    phone: schema.phone({ label: "Phone", maxLength: 50, nullable: true }),
    linkedinUrl: schema.url({ label: "LinkedIn URL", nullable: true }),
    portfolioUrl: schema.url({ label: "Portfolio URL", nullable: true }),
    resume: schema.file({
      label: "Resume",
      maxBytes: 25_000_000,
      nullable: true,
    }),
  },
  search: { fields: ["name", "email"] },
  display: { icon: "userRound", title: "name", subtitle: "email" },
})
