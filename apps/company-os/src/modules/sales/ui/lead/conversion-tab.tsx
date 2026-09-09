import { Button } from "@company/ui/button"
import { Link } from "@tanstack/react-router"

import type { Lead } from "#/modules/sales/model/lead.ts"
import type { RecordUiProps } from "#/runtime/ui/module.ts"

export function LeadConversion({ record }: RecordUiProps<typeof Lead>) {
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
                  to="/objects/$objectType/$recordId"
                  params={{
                    objectType: "company",
                    recordId: record.convertedCompany,
                  }}
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
                  to="/objects/$objectType/$recordId"
                  params={{
                    objectType: "contact",
                    recordId: record.convertedContact,
                  }}
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
            {record.company
              ? `Conversion creates a contact for ${record.name} at the linked company.`
              : record.companyName
                ? `Conversion creates ${record.companyName} and a contact for ${record.name}.`
                : "Select a company or enter a company name before converting this lead."}{" "}
            The lead stays available as the original source.
          </p>
        </>
      )}
    </section>
  )
}
