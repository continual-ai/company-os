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
      objects: module.objects.map((object) => ({
        id: object.id,
        name: object.name,
        pluralName: object.pluralName,
        description: object.description,
        fields: { ...object.fields },
        display: { ...object.display },
      })),
    })),
  }
}
