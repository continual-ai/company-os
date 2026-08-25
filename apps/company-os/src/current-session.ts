import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

export const getCurrentSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const { readCurrentSession } =
      await import("./server/auth/current-session.server")
    return readCurrentSession(getRequest().headers)
  }
)
