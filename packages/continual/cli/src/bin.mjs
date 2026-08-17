#!/usr/bin/env node

import process from "node:process"

import { startStudio } from "@continual/studio/server"

const help = `Continual developer tools

Usage:
  continual studio [options]

Studio options:
  --url <url>         Runtime origin (default: CONTINUAL_API_URL or http://localhost:4000)
  --port <number>     Local Studio port (default: 5555)
  --browser <name>    Browser to open, "default", or "none" (default: default)
  -h, --help          Show this help
`

/** @param {Array<string>} args @param {string} name */
function optionValue(args, name) {
  const equalsArgument = args.find((argument) =>
    argument.startsWith(`${name}=`)
  )
  if (equalsArgument) return equalsArgument.slice(name.length + 1)

  const index = args.indexOf(name)
  if (index === -1) return undefined

  const value = args[index + 1]
  if (!value || value.startsWith("-")) {
    throw new Error(`${name} requires a value.`)
  }

  return value
}

/** @param {Array<string>} args */
function studioOptions(args) {
  const runtimeUrl =
    optionValue(args, "--url") ??
    process.env.CONTINUAL_API_URL ??
    "http://localhost:4000"
  const parsedUrl = new URL(runtimeUrl)

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("--url must use http or https.")
  }

  const portValue = optionValue(args, "--port") ?? "5555"
  const port = Number(portValue)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("--port must be an integer between 1 and 65535.")
  }

  const browserName = optionValue(args, "--browser") ?? "default"
  if (browserName !== "default" && browserName !== "none") {
    process.env.BROWSER = browserName
  }

  return {
    browser: browserName === "none" ? false : true,
    port,
    runtimeUrl: parsedUrl.origin,
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2)

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(help)
    return
  }

  if (command !== "studio") {
    throw new Error(`Unknown command: ${command}`)
  }

  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(help)
    return
  }

  const studio = await startStudio(studioOptions(args))
  process.stdout.write(`Continual Studio: ${studio.url}\n`)

  let closing = false
  async function close() {
    if (closing) return
    closing = true
    await studio.close()
    process.exitCode = 0
  }

  process.once("SIGINT", close)
  process.once("SIGTERM", close)
}

main().catch((error) => {
  process.stderr.write(
    `continual: ${error instanceof Error ? error.message : String(error)}\n`
  )
  process.exitCode = 1
})
