import { Model } from "#/examples/model.ts"
import { createApplicationHttpApi } from "#/http-api.ts"
export const { api: applicationHttpApi, capabilityGroup } =
  createApplicationHttpApi(Model)
