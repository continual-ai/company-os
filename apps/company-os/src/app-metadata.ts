import { appConfig } from "@/customization/config"

/** Stable deployment identity shared by generated protocol adapters. */
export const appMetadata = {
  id: "application",
  name: appConfig.identity.name,
  version: "0.0.0",
} as const
