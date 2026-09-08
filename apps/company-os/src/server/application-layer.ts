import { Authentication } from "@company/runtime/server/auth/authentication"
import { IdentityBindingRepository } from "@company/runtime/server/auth/identity-binding-repository"
import type { IdentityProvider } from "@company/runtime/server/auth/identity-provider"
import { EventNotifications } from "@company/runtime/server/events/event-notifications"
import { Layer } from "effect"

import {
  makeApplicationServicesLayer,
  type ApplicationServicesInfrastructure,
} from "#/server/application-services.ts"
import { identityProviderLayer } from "#/server/auth/provider.ts"
import { Readiness } from "#/server/readiness.ts"
import { HttpTransport } from "#/server/transport/http-transport.ts"
import { McpTransport } from "#/server/transport/mcp-transport.ts"

export interface ApplicationInfrastructure extends ApplicationServicesInfrastructure {
  readonly eventNotifications?: Layer.Layer<EventNotifications, unknown>
  readonly identityProvider?: Layer.Layer<IdentityProvider, unknown>
}

/** Adds authentication and transports to the application's shared business services. */
export function makeApplicationLayer(
  infrastructure: ApplicationInfrastructure,
  services = makeApplicationServicesLayer(infrastructure)
) {
  const {
    database,
    eventNotifications = EventNotifications.layerPolling,
    identityProvider = identityProviderLayer,
  } = infrastructure
  const bindings = IdentityBindingRepository.layer.pipe(Layer.provide(services))
  const authentication = Authentication.layer.pipe(
    Layer.provide(
      Layer.mergeAll(identityProvider, services, bindings, database)
    )
  )
  const httpTransport = HttpTransport.layer.pipe(
    Layer.provide(
      Layer.mergeAll(authentication, services, database, eventNotifications)
    )
  )
  const mcpTransport = McpTransport.layer.pipe(
    Layer.provide(Layer.merge(authentication, services))
  )
  const readiness = Readiness.layer.pipe(Layer.provide(services))
  return Layer.mergeAll(
    services,
    authentication,
    httpTransport,
    mcpTransport,
    readiness
  )
}
