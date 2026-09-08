import { ConfirmActionButton } from "@company/runtime/ui/confirm-action-button"
import type { RecordUiProps } from "@company/runtime/ui/module"
import { useObjectClient } from "@company/runtime/ui/module"
import { useMutation } from "@tanstack/react-query"

import { Lead } from "#/model/lead.ts"

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
