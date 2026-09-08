import { makeApplicationServicesLayer } from "#/examples/services.server.ts"
import {
  makeApplicationLayer as assembleApplication,
  type ApplicationInfrastructure,
} from "#/server/application-layer.ts"
export function makeApplicationLayer(
  infrastructure: ApplicationInfrastructure
) {
  return assembleApplication(
    infrastructure,
    makeApplicationServicesLayer(infrastructure)
  )
}
