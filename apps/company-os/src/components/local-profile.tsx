import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

const displayNameStorageKey = "acme-company-os-display-name"
const emailStorageKey = "acme-company-os-email"

type LocalProfile = {
  displayName: string
  email: string
}

type LocalProfileContextValue = {
  hydrated: boolean
  profile: LocalProfile
  updateProfile: (profile: Partial<LocalProfile>) => void
}

const defaultProfile: LocalProfile = {
  displayName: "Acme operator",
  email: "",
}

const LocalProfileContext = createContext<LocalProfileContextValue | null>(null)

export function LocalProfileProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [profile, setProfile] = useState(defaultProfile)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setProfile({
      displayName:
        window.localStorage.getItem(displayNameStorageKey)?.trim() ||
        defaultProfile.displayName,
      email: window.localStorage.getItem(emailStorageKey)?.trim() || "",
    })
    setHydrated(true)
  }, [])

  const updateProfile = useCallback((profileUpdate: Partial<LocalProfile>) => {
    setProfile((currentProfile) => {
      const nextProfile = { ...currentProfile, ...profileUpdate }
      window.localStorage.setItem(
        displayNameStorageKey,
        nextProfile.displayName
      )
      window.localStorage.setItem(emailStorageKey, nextProfile.email)
      return nextProfile
    })
  }, [])

  const value = useMemo<LocalProfileContextValue>(
    () => ({
      hydrated,
      profile,
      updateProfile,
    }),
    [hydrated, profile, updateProfile]
  )

  return (
    <LocalProfileContext.Provider value={value}>
      {children}
    </LocalProfileContext.Provider>
  )
}

export function useLocalProfile() {
  const value = useContext(LocalProfileContext)
  if (!value) {
    throw new Error("useLocalProfile must be used within LocalProfileProvider")
  }

  return value
}

export function getProfileInitials(displayName: string) {
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

  return initials || "AO"
}
