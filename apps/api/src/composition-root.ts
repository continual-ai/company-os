import { Acme } from "@acme/model"
import { describeModel } from "@continual/runtime"

const company = Acme
export const modelDescription = describeModel(company)

// Repositories, services, capability ports, and provider adapters are bound here.
// Keep provider-specific types on this side of the composition boundary.
