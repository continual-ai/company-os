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
  readonly title?: string | undefined
}) {
  return (
    <FieldSet className="gap-3 border-0 p-0 pt-2 first:pt-0">
      {title === undefined ? null : (
        <FieldLegend className="mb-0 text-xs">{title}</FieldLegend>
      )}
      {description === undefined ? null : (
        <FieldDescription>{description}</FieldDescription>
      )}
      <FieldGroup className="gap-3 [&_[data-slot=field]]:gap-1.5">
        {children}
      </FieldGroup>
    </FieldSet>
  )
}
