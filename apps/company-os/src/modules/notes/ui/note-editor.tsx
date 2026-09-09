import { MarkdownEditor } from "#/runtime/ui/components/markdown-editor.tsx"
import type { FieldEditorProps } from "#/runtime/ui/module.ts"

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
