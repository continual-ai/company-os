import { defineInterface } from "@company/runtime"

/** Marker for business records that can have notes attached. */
export const NoteSubject = defineInterface({
  id: "noteSubject",
  name: "Note subject",
  pluralName: "Note subjects",
  description: "A business record that can have notes attached.",
})
