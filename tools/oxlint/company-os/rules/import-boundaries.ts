import { extname } from "node:path"

import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

const CENTRAL_APP_SOURCE = /(?:^|\/)apps\/company-os\/src\/(.+)$/
const CENTRAL_APP_PACKAGE = "company-os"
const UI_PACKAGE = "@company/ui"
/** The design system: primitives, hooks, lib, and styles that no app or model may leak into. */
const UI_PACKAGE_SOURCE = /(?:^|\/)packages\/ui\//
/** Every workspace app other than the central one is a satellite over its exports. */
const SATELLITE_APP = /(?:^|\/)apps\/(?!company-os\/)[^/]+\//
const APP_PACKAGE_SCOPE = "@company/"
const SATELLITE_ALLOWED_CENTRAL_IMPORTS = new Set([
  "company-os/client",
  "company-os/config",
  "company-os/model",
])
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/
const MODULE_SURFACES = new Set(["model", "server", "ui", "seeds"])

/** Role of a central-app source file, derived from its path below `apps/company-os/src/`. */
interface SourceRole {
  readonly browser: boolean
  readonly model: boolean
  /** Portable kernel layers that build Effect schemas and may import `effect` and `typeid-js`. */
  readonly modelWithEffect: boolean
  readonly module: { readonly name: string; readonly surface: string } | null
  readonly runtime: boolean
  readonly runtimeServer: boolean
  readonly test: boolean
}

function normalize(filename: string): string {
  return filename.replaceAll("\\", "/")
}

function centralAppSourcePath(filename: string): string | null {
  return normalize(filename).match(CENTRAL_APP_SOURCE)?.[1] ?? null
}

function sourceRole(sourcePath: string): SourceRole {
  const moduleMatch = sourcePath.match(/^modules\/([^/]+)\/(?:([^/]+)\/)?/)
  const module = moduleMatch?.[1]
    ? { name: moduleMatch[1], surface: moduleMatch[2] ?? "" }
    : null
  const modelWithEffect =
    sourcePath.startsWith("runtime/model/") ||
    sourcePath.startsWith("runtime/contract/")
  const model =
    modelWithEffect ||
    sourcePath.startsWith("runtime/access/model/") ||
    sourcePath.startsWith("runtime/assets/model/") ||
    sourcePath.startsWith("runtime/platform/model/") ||
    module?.surface === "model" ||
    sourcePath === "app.model.ts"
  const runtime = sourcePath.startsWith("runtime/")
  const runtimeServer =
    sourcePath.startsWith("runtime/server/") ||
    /^runtime\/[^/]+\/server\//.test(sourcePath)
  const browser =
    sourcePath.startsWith("runtime/client/") ||
    sourcePath.startsWith("runtime/ui/") ||
    /^runtime\/[^/]+\/ui\//.test(sourcePath) ||
    sourcePath.startsWith("app/ui/") ||
    sourcePath.startsWith("app/customization/") ||
    (sourcePath.startsWith("routes/") &&
      !sourcePath.startsWith("routes/api/") &&
      sourcePath.endsWith(".tsx")) ||
    module?.surface === "ui"
  return {
    browser,
    model,
    modelWithEffect,
    module,
    runtime,
    runtimeServer,
    test: TEST_FILE.test(sourcePath),
  }
}

function isPackage(specifier: string, packageName: string): boolean {
  return specifier === packageName || specifier.startsWith(`${packageName}/`)
}

/** The `#/` target as an absolute-style source path (`/runtime/server/x.ts`) so leading segments match `/segment/` tests. */
function privateTarget(specifier: string): string | null {
  return specifier.startsWith("#/") ? specifier.slice(1) : null
}

function targetHasSegment(
  target: string | null,
  segments: ReadonlyArray<string>
): boolean {
  return (
    target !== null &&
    segments.some((segment) => target.includes(`/${segment}/`))
  )
}

function isNodeOrPostgres(specifier: string): boolean {
  return (
    specifier.startsWith("node:") ||
    specifier === "pg" ||
    isPackage(specifier, "@effect/sql") ||
    specifier.startsWith("@effect/sql-")
  )
}

function modelReason(role: SourceRole, specifier: string): string | null {
  const target = privateTarget(specifier)
  if (
    targetHasSegment(target, [
      "server",
      "ui",
      "client",
      "seeds",
      "testing",
      "app",
      "routes",
    ]) ||
    target?.endsWith(".tsx") ||
    isPackage(specifier, UI_PACKAGE)
  )
    return "Portable model definitions cannot import execution, persistence, client, presentation, or application code."
  if (
    (!role.modelWithEffect && isPackage(specifier, "effect")) ||
    isPackage(specifier, "react") ||
    isPackage(specifier, "react-dom") ||
    specifier.startsWith("node:") ||
    specifier === "pg" ||
    specifier.startsWith("@effect/") ||
    specifier.startsWith("@tanstack/")
  )
    return "Portable model definitions stay free of Effect, React, Node, PostgreSQL, and TanStack dependencies."
  return null
}

function runtimeReason(role: SourceRole, specifier: string): string | null {
  const target = privateTarget(specifier)
  if (target === null) return null
  if (
    target.startsWith("/modules/") ||
    target.startsWith("/app/") ||
    target.startsWith("/routes/") ||
    /^\/app\.[^/]+\.[cm]?[jt]sx?$/.test(target)
  )
    return "The runtime kernel cannot depend on domain modules, the application shell, routes, or composition roots."
  if (
    role.runtimeServer &&
    (target.startsWith("/runtime/ui/") ||
      /^\/runtime\/[^/]+\/ui\//.test(target))
  )
    return "Server execution cannot depend on React presentation."
  return null
}

function serverUiReason(role: SourceRole, specifier: string): string | null {
  return role.runtimeServer && isPackage(specifier, UI_PACKAGE)
    ? "Server execution cannot depend on React presentation."
    : null
}

function moduleReason(
  module: NonNullable<SourceRole["module"]>,
  specifier: string
): string | null {
  const target = privateTarget(specifier)
  if (target !== null) {
    if (
      target.startsWith("/app/") ||
      target.startsWith("/routes/") ||
      target === "/app.config.ts" ||
      target === "/app.server.ts" ||
      target === "/app.ui.ts"
    )
      return "Domain modules cannot depend on the application shell, routes, or composition roots; the app composes modules."
    const otherModule = target.match(/^\/modules\/([^/]+)\/(server|ui|seeds)\//)
    if (
      otherModule &&
      otherModule[1] !== module.name &&
      !(
        module.surface === "seeds" &&
        /^\/modules\/[^/]+\/seeds\/index\.ts$/.test(target)
      )
    )
      return `Another module's ${otherModule[2] ?? ""}/ is private; depend only on its model/.`
  }
  const server = module.surface === "server" || module.surface === "seeds"
  if (
    server &&
    (targetHasSegment(target, ["ui"]) ||
      target?.endsWith(".tsx") ||
      isPackage(specifier, UI_PACKAGE))
  )
    return "Module server execution cannot depend on presentation."
  if (
    !server &&
    (targetHasSegment(target, ["server", "seeds", "testing"]) ||
      isNodeOrPostgres(specifier))
  )
    return "Module server dependencies belong in server/ or seeds/."
  return null
}

function uiPackageReason(specifier: string): string | null {
  if (
    isPackage(specifier, CENTRAL_APP_PACKAGE) ||
    specifier.startsWith(APP_PACKAGE_SCOPE) ||
    isPackage(specifier, "effect") ||
    specifier.startsWith("@effect/") ||
    specifier.startsWith("@tanstack/")
  )
    return "The design system depends on no app, model, Effect, or TanStack code; apps compose its primitives, never the reverse."
  return null
}

function browserReason(specifier: string): string | null {
  const target = privateTarget(specifier)
  if (
    targetHasSegment(target, ["server", "seeds", "testing"]) ||
    isNodeOrPostgres(specifier)
  )
    return "Browser code cannot import server execution, seeds, persistence, or test infrastructure."
  return null
}

function centralAppReason(role: SourceRole, specifier: string): string | null {
  if (
    specifier.startsWith(APP_PACKAGE_SCOPE) &&
    !isPackage(specifier, UI_PACKAGE)
  )
    return "The central app cannot depend on satellite apps; they depend on it."
  if (isPackage(specifier, CENTRAL_APP_PACKAGE))
    return "Use #/ for private imports inside the central app instead of its package name."
  return (
    (role.model ? modelReason(role, specifier) : null) ??
    (role.runtime ? runtimeReason(role, specifier) : null) ??
    serverUiReason(role, specifier) ??
    (role.module && !role.test ? moduleReason(role.module, specifier) : null) ??
    (role.browser && !role.test ? browserReason(specifier) : null)
  )
}

function satelliteReason(specifier: string): string | null {
  if (
    specifier.startsWith(APP_PACKAGE_SCOPE) &&
    !isPackage(specifier, UI_PACKAGE)
  )
    return "Satellite apps are independent deployables and cannot import one another."
  if (
    isPackage(specifier, CENTRAL_APP_PACKAGE) &&
    !SATELLITE_ALLOWED_CENTRAL_IMPORTS.has(specifier)
  )
    return "Satellite apps consume the central app only through company-os/model, company-os/client, and company-os/config; primitives come from @company/ui."
  return null
}

function boundaryReason(filename: string, specifier: string): string | null {
  const sourcePath = centralAppSourcePath(filename)
  if (sourcePath !== null)
    return centralAppReason(sourceRole(sourcePath), specifier)
  if (UI_PACKAGE_SOURCE.test(normalize(filename)))
    return uiPackageReason(specifier)
  if (SATELLITE_APP.test(normalize(filename))) return satelliteReason(specifier)
  return null
}

function privateImportReason(specifier: string): string | null {
  if (
    specifier.startsWith("@/") ||
    (specifier.startsWith("#") && !specifier.startsWith("#/"))
  )
    return "Use #/ for private source imports; named private aliases and @/ are not allowed."
  if (specifier.startsWith("."))
    return "Use #/ with an explicit file extension for all private source imports, including siblings."
  if (specifier.startsWith("#/")) {
    const path = specifier.slice(2)
    if (
      path
        .split("/")
        .some((part) => part === "." || part === ".." || part === "") ||
      !extname(path)
    )
      return "Use a direct #/ source path with an explicit file extension."
  }
  return null
}

/** Enforce the path-based import direction between the kernel, domain modules, the shell, and optional apps. */
export const importBoundariesRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce Company OS import direction between runtime, modules, app shell, browser, and server code.",
    },
    messages: {
      moduleLayout:
        "Put module source in model/, server/, ui/, or seeds/. Public surfaces use <surface>/index.ts; omit unused surfaces.",
      forbiddenImport:
        'Import from "{{specifier}}" is forbidden here. {{reason}}',
    },
  },
  createOnce(context) {
    function checkSpecifier(node: ESTree.Node, specifier: string): void {
      const reason =
        privateImportReason(specifier) ??
        boundaryReason(context.filename, specifier)
      if (!reason) return

      context.report({
        node,
        messageId: "forbiddenImport",
        data: { reason, specifier },
      })
    }

    function checkSource(source: ESTree.StringLiteral): void {
      checkSpecifier(source, source.value)
    }

    return {
      Program(node) {
        const sourcePath = centralAppSourcePath(context.filename)
        if (sourcePath === null) return
        const role = sourceRole(sourcePath)
        if (
          role.module &&
          !role.test &&
          !MODULE_SURFACES.has(role.module.surface)
        ) {
          context.report({ node, messageId: "moduleLayout" })
        }
      },
      ExportAllDeclaration(node) {
        checkSource(node.source)
      },
      ExportNamedDeclaration(node) {
        if (node.source) checkSource(node.source)
      },
      ImportDeclaration(node) {
        checkSource(node.source)
      },
      ImportExpression(node) {
        if (node.source.type === "Literal")
          checkSpecifier(node.source, String(node.source.value))
      },
      TSImportType(node) {
        checkSource(node.source)
      },
    }
  },
})
