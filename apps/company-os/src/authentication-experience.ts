interface LocalAuthenticationProfile {
  readonly description: string
  readonly email: string
  readonly id: string
  readonly name: string
  readonly role: string
}

export type AuthenticationExperience =
  | {
      readonly kind: "external"
      readonly signInPath: string
    }
  | {
      readonly kind: "local"
      readonly profiles: ReadonlyArray<LocalAuthenticationProfile>
      readonly selectedProfileId: string | undefined
    }
