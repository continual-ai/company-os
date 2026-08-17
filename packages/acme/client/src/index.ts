import type {
  RuntimeClientModel,
  RuntimeClientOptions,
} from "@continual/client"

import type { Acme } from "@acme/model"

export type AcmeClientModel = RuntimeClientModel<typeof Acme>
export type AcmeClientOptions = RuntimeClientOptions
