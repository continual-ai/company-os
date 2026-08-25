import { Model } from "@company/model"
import { createClient } from "@company/runtime/client"

/** Same-origin browser client inferred from the canonical model. */
export const companyClient = createClient(Model)
