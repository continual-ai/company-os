import { useMutation } from "@tanstack/react-query"
import type { Model } from "company-os/model"

import { data } from "@/app-client"
import { ConfirmActionButton } from "@/ui/model/confirm-action-button"
import type { RecordUiProps } from "@/ui/model/module-ui"

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
      description="Creates a company and contact linked to this lead."
      onConfirm={async () => {
        await convert.mutateAsync({ id: record.id })
      }}
    />
  )
}
