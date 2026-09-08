import { Textarea } from "@company/ui/components/textarea"
import type { FieldEditorProps } from "@company/ui/model/object-ui"

export function IssueDescription({
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
    <Textarea
      id={id}
      name={name}
      required={required}
      rows={10}
      placeholder="Expected behavior, observed behavior, and acceptance criteria"
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      onBlur={onBlur}
      aria-invalid={invalid}
      aria-describedby={ariaDescribedBy}
    />
  )
}
