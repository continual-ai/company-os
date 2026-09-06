import { Button } from "@company/ui/components/button"
import { Link } from "@tanstack/react-router"
import type { Model } from "company-os/model"

import type { RecordUiProps } from "@/ui/model/module-ui"

export function LeadConversion({
  record,
}: RecordUiProps<typeof Model.objects.lead>) {
  return (
    <section className="mx-auto grid w-full max-w-3xl gap-4 p-5">
      {record.convertedCompany && record.convertedContact ? (
        <>
          <h2 className="font-medium">Customer records created</h2>
          <p className="text-sm text-muted-foreground">
            This lead has been converted. Continue work in its company and
            contact records.
          </p>
          <div className="flex gap-3">
            <Button
              nativeButton={false}
              render={
                <Link
                  to="/companies/$recordId"
                  params={{ recordId: record.convertedCompany }}
                />
              }
            >
              Open company
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link
                  to="/contacts/$recordId"
                  params={{ recordId: record.convertedContact }}
                />
              }
            >
              Open contact
            </Button>
          </div>
        </>
      ) : (
        <>
          <h2 className="font-medium">
            Ready to become a customer relationship?
          </h2>
          <p className="text-sm text-muted-foreground">
            Conversion creates a company from {record.companyName} and a contact
            from {record.name}. The lead stays available as the original source.
          </p>
        </>
      )}
    </section>
  )
}
