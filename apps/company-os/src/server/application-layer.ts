import { Layer } from "effect"

import {
  makeApplicationServicesLayer,
  type ApplicationServicesInfrastructure,
} from "#/server/application-services.ts"
import { Authentication } from "#/server/auth/authentication.ts"
import { IdentityBindingRepository } from "#/server/auth/identity-binding-repository.ts"
import { IdentityProvider } from "#/server/auth/identity-provider.ts"
import { EventNotifications } from "#/server/events/event-notifications.ts"
import { Readiness } from "#/server/readiness.ts"
import { HttpTransport } from "#/server/transport/http-transport.ts"
import { McpTransport } from "#/server/transport/mcp-transport.ts"

export interface ApplicationInfrastructure extends ApplicationServicesInfrastructure {
  readonly eventNotifications?: Layer.Layer<EventNotifications, unknown>
  readonly identityProvider?: Layer.Layer<IdentityProvider, unknown>
}

/** Adds authentication and transports to the application's shared business services. */
export function makeApplicationLayer(
  infrastructure: ApplicationInfrastructure
) {
  const {
    database,
    eventNotifications = EventNotifications.layerPolling,
    identityProvider = IdentityProvider.layer,
  } = infrastructure
  const services = makeApplicationServicesLayer(infrastructure)
  const bindings = IdentityBindingRepository.layer.pipe(Layer.provide(database))
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
  const readiness = Readiness.layer.pipe(Layer.provide(database))
  return Layer.mergeAll(
    services,
    authentication,
    httpTransport,
    mcpTransport,
    readiness
  )
}
