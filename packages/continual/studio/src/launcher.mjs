import { fileURLToPath } from "node:url"

import { createServer } from "vite"

const studioRoot = fileURLToPath(new URL("..", import.meta.url))
const configFile = fileURLToPath(new URL("../vite.config.ts", import.meta.url))

/**
 * @param {{
 *   browser?: boolean | string
 *   port?: number
 *   runtimeUrl: string
 * }} options
 */
export async function startStudio({ browser = true, port = 5555, runtimeUrl }) {
  process.env.CONTINUAL_STUDIO_RUNTIME_URL = runtimeUrl

  const server = await createServer({
    configFile,
    root: studioRoot,
    server: {
      host: "127.0.0.1",
      open: browser,
      port,
      strictPort: true,
    },
  })

  await server.listen()

  return {
    close: () => server.close(),
    url: server.resolvedUrls?.local[0] ?? `http://127.0.0.1:${port}`,
  }
}
