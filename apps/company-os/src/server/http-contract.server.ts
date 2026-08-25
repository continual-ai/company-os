import { Model } from "@company/model"
import { createHttpApi } from "@company/runtime/effect/http"

/** The executable HTTP contract shared by routing, OpenAPI, and documentation. */
export const applicationHttpApi = createHttpApi(Model)
