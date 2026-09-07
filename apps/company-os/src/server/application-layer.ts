import { Layer } from "effect"

import {
  makeApplicationServicesLayer,
  type ApplicationServicesInfrastructure,
} from "./application-services"
import { Authentication } from "./auth/authentication"
import { IdentityBindingRepository } from "./auth/identity-binding-repository"
import { IdentityProvider } from "./auth/identity-provider"
import { EventNotifications } from "./events/event-notifications"
import { Readiness } from "./readiness"
import { HttpTransport } from "./transport/http-transport"
import { McpTransport } from "./transport/mcp-transport"

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
