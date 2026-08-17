import type { Acme } from "@acme/model"
import type {
  RuntimeClientModel,
  RuntimeClientOptions,
} from "@continual/client"

export type AcmeClientModel = RuntimeClientModel<typeof Acme>
export type AcmeClientOptions = RuntimeClientOptions
