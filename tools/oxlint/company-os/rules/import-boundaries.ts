import { extname } from "node:path"

import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

const CENTRAL_APP_SOURCE = /(?:^|\/)apps\/company-os\/src\/(.+)$/
const CENTRAL_APP_PACKAGE = "company-os"
const TEMPLATE_PACKAGE_SCOPE = "@company-template/"
const TEMPLATE_ALLOWED_CENTRAL_IMPORTS = new Set([
  "company-os/client",
  "company-os/config",
  "company-os/model",
  "company-os/styles.css",
])
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/
const MODULE_SURFACES = new Set(["model", "server", "ui", "seeds"])

/** Role of a central-app source file, derived from its path below `apps/company-os/src/`. */
interface SourceRole {
  readonly browser: boolean
  readonly model: boolean
  /** Portable kernel layers that build Effect schemas and may import `effect` and `typeid-js`. */
  readonly modelWithEffect: boolean
  /** shadcn primitives under `runtime/ui/components`, which depend only on other primitives, `ui/lib`, and `ui/hooks`. */
  readonly primitive: boolean
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
    module?.surface === "model" ||
    sourcePath === "app.model.ts"
  const runtime = sourcePath.startsWith("runtime/")
  const primitive = sourcePath.startsWith("runtime/ui/components/")
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
    primitive,
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
    target?.endsWith(".tsx")
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
  if (server && (targetHasSegment(target, ["ui"]) || target?.endsWith(".tsx")))
    return "Module server execution cannot depend on presentation."
  if (
    !server &&
    (targetHasSegment(target, ["server", "seeds", "testing"]) ||
      isNodeOrPostgres(specifier))
  )
    return "Module server dependencies belong in server/ or seeds/."
  return null
}

const PRIMITIVE_TARGETS = [
  "/runtime/ui/components/",
  "/runtime/ui/lib/",
  "/runtime/ui/hooks/",
]

function primitiveReason(specifier: string): string | null {
  const target = privateTarget(specifier)
  if (
    target !== null &&
    !PRIMITIVE_TARGETS.some((prefix) => target.startsWith(prefix))
  )
    return "UI primitives depend only on other primitives, ui/lib, and ui/hooks; model presentation composes them, never the reverse."
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
  if (specifier.startsWith(TEMPLATE_PACKAGE_SCOPE))
    return "The central app cannot depend on optional app templates."
  if (isPackage(specifier, CENTRAL_APP_PACKAGE))
    return "Use #/ for private imports inside the central app instead of its package name."
  return (
    (role.model ? modelReason(role, specifier) : null) ??
    (role.runtime ? runtimeReason(role, specifier) : null) ??
    (role.primitive && !role.test ? primitiveReason(specifier) : null) ??
    (role.module && !role.test ? moduleReason(role.module, specifier) : null) ??
    (role.browser && !role.test ? browserReason(specifier) : null)
  )
}

function templateReason(specifier: string): string | null {
  if (specifier.startsWith(TEMPLATE_PACKAGE_SCOPE))
    return "Optional apps are independent deployables and cannot import one another."
  if (
    isPackage(specifier, CENTRAL_APP_PACKAGE) &&
    !TEMPLATE_ALLOWED_CENTRAL_IMPORTS.has(specifier) &&
    !specifier.startsWith("company-os/ui/")
  )
    return "Optional apps consume the central app only through company-os/model, company-os/client, company-os/config, company-os/ui/*, and company-os/styles.css."
  return null
}

function boundaryReason(filename: string, specifier: string): string | null {
  const sourcePath = centralAppSourcePath(filename)
  if (sourcePath !== null)
    return centralAppReason(sourceRole(sourcePath), specifier)
  if (/(?:^|\/)templates\/[^/]+\//.test(normalize(filename)))
    return templateReason(specifier)
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
