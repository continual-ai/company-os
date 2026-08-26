import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

import { readCurrentUser } from "./server/auth/current-user"

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async () => readCurrentUser(getRequest().headers)
)
