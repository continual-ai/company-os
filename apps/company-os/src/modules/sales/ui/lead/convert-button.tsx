import { ConfirmActionButton } from "@company/ui/confirm-action-button"
import { useMutation } from "@tanstack/react-query"

import { Lead } from "#/modules/sales/model/lead.ts"
import type { RecordUiProps } from "#/runtime/ui/module.ts"
import { useObjectClient } from "#/runtime/ui/module.ts"

export function ConvertLeadAction({ record }: RecordUiProps<typeof Lead>) {
  const convert = useMutation(useObjectClient(Lead).convert())
  if (record.convertedAt !== null) return null
  return (
    <ConfirmActionButton
      actionLabel="Convert"
      destructive={false}
      title="Convert this lead?"
      description={
        record.company
          ? "Creates a contact at the linked company."
          : "Creates a company and contact linked to this lead."
      }
      onConfirm={async () => {
        await convert.mutateAsync({ id: record.id })
      }}
    />
  )
}
