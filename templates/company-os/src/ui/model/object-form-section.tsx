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
    <FieldSet className="border-t pt-4 first:border-t-0 first:pt-0">
      <FieldLegend>{title}</FieldLegend>
      {description === undefined ? null : (
        <FieldDescription>{description}</FieldDescription>
      )}
      <FieldGroup className="gap-4">{children}</FieldGroup>
    </FieldSet>
  )
}
