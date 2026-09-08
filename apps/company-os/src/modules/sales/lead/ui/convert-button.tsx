import type { RecordUiProps } from "@company/ui/model/object-ui"
import { useMutation } from "@tanstack/react-query"

import { data } from "#/app-client.ts"
import type { Model } from "#/app.model.ts"
import { ConfirmActionButton } from "#/ui/model/confirm-action-button.tsx"

export function ConvertLeadAction({
  record,
}: RecordUiProps<typeof Model.objects.lead>) {
  const convert = useMutation(data.lead.convert())
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
