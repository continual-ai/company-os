import { MarkdownEditor } from "@company/runtime/ui/markdown-editor"
import type { FieldEditorProps } from "@company/runtime/ui/module"

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
