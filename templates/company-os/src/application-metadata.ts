import { applicationConfig } from "@/customization/config"

/** Stable deployment identity shared by generated protocol adapters. */
export const applicationMetadata = {
  id: "application",
  name: applicationConfig.identity.productName,
  version: "0.0.0",
} as const
