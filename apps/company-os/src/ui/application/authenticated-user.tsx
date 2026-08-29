import { createContext, useContext } from "react"

import type { AuthenticatedUser } from "@/authentication"

const AuthenticatedUserContext = createContext<AuthenticatedUser | null>(null)

export function AuthenticatedUserProvider({
  children,
  user,
}: {
  children: React.ReactNode
  user: AuthenticatedUser
}) {
  return (
    <AuthenticatedUserContext.Provider value={user}>
      {children}
    </AuthenticatedUserContext.Provider>
  )
}

export function useAuthenticatedUser() {
  const user = useContext(AuthenticatedUserContext)
  if (user === null) {
    throw new Error(
      "useAuthenticatedUser must be used within AuthenticatedUserProvider"
    )
  }
  return user
}

export function getUserInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  )
}
