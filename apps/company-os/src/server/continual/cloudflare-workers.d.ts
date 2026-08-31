/**
 * Minimal declaration for the workerd-only entrypoint so the application can
 * probe for Worker bindings without adopting the Workers global type surface.
 */
declare module "cloudflare:workers" {
  export const env: unknown
}
