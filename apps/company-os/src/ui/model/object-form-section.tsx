import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@company/ui/components/field"
import type { ReactNode } from "react"

export function ObjectFormSection({
  children,
  description,
  title,
}: {
  readonly children: ReactNode
  readonly description?: string | undefined
  readonly title: string
}) {
  return (
    <FieldSet className="border-0 p-0 pt-2 first:pt-0">
      <FieldLegend className="mb-0 w-full border-b pb-2">{title}</FieldLegend>
      {description === undefined ? null : (
        <FieldDescription>{description}</FieldDescription>
      )}
      <FieldGroup className="gap-4">{children}</FieldGroup>
    </FieldSet>
  )
}
