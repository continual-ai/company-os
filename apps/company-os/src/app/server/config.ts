import { ConfigProvider, Effect, Option } from "effect"

/**
 * Values a fresh checkout needs to run locally. They are the lowest-precedence
 * source and are never consulted in production, where every value is explicit.
 */
export const developmentDefaults = ConfigProvider.fromUnknown({
  APP_SECRET: "company-os-application-secret-local-development-only",
  DATABASE_URL: "postgresql://localhost:5433/company_os",
})

/** Local override files, app-level first, resolved from the app directory the tools run in. */
const localEnvironmentFiles = [".env.local", "../../.env.local"]

/**
 * Configuration for repository tools: the process environment, then `.env.local`
 * in the app and the repository, then the development defaults when asked.
 * Missing files are skipped. The dev server reaches the same result through
 * Vite, which loads the same files into the process environment.
 */
export function localConfigProvider(options: {
  readonly development: boolean
}) {
  return Effect.gen(function* () {
    let provider = ConfigProvider.fromEnv()
    for (const path of localEnvironmentFiles) {
      const file = yield* ConfigProvider.fromDotEnv({ path }).pipe(
        Effect.option
      )
      if (Option.isSome(file))
        provider = ConfigProvider.orElse(provider, file.value)
    }
    return options.development
      ? ConfigProvider.orElse(provider, developmentDefaults)
      : provider
  })
}
