import { Acme } from "@acme/contract"
import { describeCompany } from "@continual/runtime"

export const contractDescription = describeCompany(Acme)

// Repositories, services, capability ports, provider adapters, and Effect
// layers are assembled here. Transport routes remain thin projections over
// the same governed company capabilities used by the Console.
