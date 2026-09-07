import { MarkdownEditor } from "@company/ui/components/markdown-editor"

import type { FieldEditorProps } from "@/ui/model/module-ui"

export function NoteEditor({
  id,
  name,
  required,
  value,
  onValueChange,
  onBlur,
  invalid,
  ariaDescribedBy,
}: FieldEditorProps) {
  return (
    <MarkdownEditor
      id={id}
      name={name}
      required={required}
      value={typeof value === "string" ? value : ""}
      onValueChange={onValueChange}
      onBlur={onBlur}
      aria-invalid={invalid}
      aria-describedby={ariaDescribedBy}
      placeholder="Write a note… Markdown supported."
    />
  )
}
