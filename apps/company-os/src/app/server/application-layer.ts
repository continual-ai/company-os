import { Layer } from "effect"

import {
  makeApplicationServicesLayer,
  type ApplicationServicesInfrastructure,
} from "#/app/server/application-services.ts"
import { identityProviderLayer } from "#/app/server/auth/provider.ts"
import * as Postgres from "#/app/server/database/postgres.ts"
import { Readiness } from "#/app/server/readiness.ts"
import { HttpTransport } from "#/app/server/transport/http-transport.ts"
import { McpTransport } from "#/app/server/transport/mcp-transport.ts"
import { Authentication } from "#/runtime/server/auth/authentication.ts"
import { IdentityBindingRepository } from "#/runtime/server/auth/identity-binding-repository.ts"
import type { IdentityProvider } from "#/runtime/server/auth/identity-provider.ts"
import { EventNotifications } from "#/runtime/server/events/event-notifications.ts"

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

/** The deployed application: PostgreSQL infrastructure, business services, authentication, and transports. */
export const applicationLayer = makeApplicationLayer({
  database: Postgres.databaseLayer,
  eventNotifications: Postgres.eventNotificationsLayer,
})
