import type { DefinedCompany } from "./definition/company"
import {
  COMPANY_DESCRIPTION_VERSION,
  type CompanyDescription,
} from "./description-types"

/** Derives transport- and UI-safe metadata from the live company contract. */
export function describeCompany(company: DefinedCompany): CompanyDescription {
  return {
    version: COMPANY_DESCRIPTION_VERSION,
    company: { id: company.id, name: company.name },
    modules: company.modules.map((module) => ({
      id: module.id,
      name: module.name,
      actions: module.actions.map((action) => ({ ...action })),
      objects: module.objects.map((object) => {
        const description: CompanyDescription["modules"][number]["objects"][number] =
          {
            id: object.id,
            collection: object.collection,
            name: object.name,
            pluralName: object.pluralName,
            operations: { ...object.operations },
            fields: { ...object.fields },
            display: { ...object.display },
          }
        if (object.description !== undefined) {
          description.description = object.description
        }
        return description
      }),
    })),
  }
}
