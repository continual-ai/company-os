import { ManagedRuntime } from "effect"

import { application } from "./composition-root.server"

/** Long-lived runtime for request handlers; its scoped infrastructure is built once. */
export const applicationRuntime = ManagedRuntime.make(application.layer)
