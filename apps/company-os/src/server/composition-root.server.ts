import { AcmeApi } from "@acme/api"
import { describeCompany } from "@continual/runtime"

export const apiDescription = describeCompany(AcmeApi)

// Repositories, services, capability ports, provider adapters, and Effect
// layers are assembled here. Transport routes remain thin projections over
// the same governed company capabilities used by the Console.
