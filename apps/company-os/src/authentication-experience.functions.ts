import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"
import { Schema } from "effect"

import { readAuthenticationExperience } from "./server/auth/authentication-experience"

export const getAuthenticationExperience = createServerFn({ method: "GET" })
  .validator(Schema.decodeUnknownSync(Schema.String))
  .handler(({ data }) =>
    readAuthenticationExperience(getRequest().headers, data)
  )
