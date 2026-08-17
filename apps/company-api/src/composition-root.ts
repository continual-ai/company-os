import { Acme } from "@acme/contract"
import { describeCompany } from "@continual/runtime"

const company = Acme
export const contractDescription = describeCompany(company)

// Repositories, services, capability ports, and provider adapters are bound here.
// Keep provider-specific types on this side of the composition boundary.
