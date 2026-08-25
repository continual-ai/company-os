import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

import { readCurrentSession } from "./server/auth/current-session"

export const getCurrentSession = createServerFn({ method: "GET" }).handler(
  async () => readCurrentSession(getRequest().headers)
)
