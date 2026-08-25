import { useCallback, useState } from "react"

import { authClient } from "./auth-client"

async function endSession(): Promise<string | undefined> {
  const result = await authClient.signOut()
  if (result.error) {
    return result.error.message ?? "The session could not be ended."
  }
  window.location.assign("/sign-in")
  return undefined
}

export function useSignOut() {
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  const signOut = useCallback(async () => {
    setError(undefined)
    setPending(true)
    const message = await endSession()
    if (message !== undefined) {
      setError(message)
      setPending(false)
    }
  }, [])

  return { error, pending, signOut }
}
