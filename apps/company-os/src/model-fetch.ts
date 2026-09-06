import { createIsomorphicFn } from "@tanstack/react-start"

/** SSR calls the same governed transport locally, with the current request's credentials. */
export const modelFetch = createIsomorphicFn()
  .client((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))
  .server(async (input: RequestInfo | URL, init?: RequestInit) => {
    const { getRequest } = await import("@tanstack/react-start/server")
    const { applicationRuntime } = await import("./server/application-runtime")
    const { HttpTransport } = await import("./server/transport/http-transport")
    const { Effect } = await import("effect")
    const incoming = getRequest()
    const outgoing = new Request(
      input instanceof Request ? input : new URL(input, incoming.url),
      init
    )
    const headers = new Headers(outgoing.headers)
    for (const name of [
      "cookie",
      "authorization",
      "x-continual-app-runtime-assertion",
      "x-continual-app-runtime-origin",
    ]) {
      const value = incoming.headers.get(name)
      if (value !== null) headers.set(name, value)
    }
    const request = new Request(outgoing, { headers })
    return applicationRuntime.runPromise(
      HttpTransport.pipe(
        Effect.flatMap((transport) => transport.handle(request))
      ),
      { signal: request.signal }
    )
  })

/** HTTP request construction needs an absolute origin before the Fetch adapter runs. */
export const modelOrigin = createIsomorphicFn()
  .client(async () => window.location.origin)
  .server(async () => {
    const { getRequest } = await import("@tanstack/react-start/server")
    return new URL(getRequest().url).origin
  })
