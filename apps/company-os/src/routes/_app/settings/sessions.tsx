import { Badge } from "@company/ui/components/badge"
import { Button } from "@company/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@company/ui/components/table"
import { createFileRoute } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"

import { authClient } from "@/auth-client"
import { ConfirmActionButton } from "@/components/confirm-action-button"
import { SettingsPage } from "@/components/settings-page"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Sessions",
  description: "Review and revoke browser sessions for your user.",
  title: "Sessions",
}

export const Route = createFileRoute("/_app/settings/sessions")({
  ...pageOptions(page),
  component: SessionsSettings,
})

type Session = NonNullable<
  Awaited<ReturnType<typeof authClient.listSessions>>["data"]
>[number]

function SessionsSettings() {
  const [sessions, setSessions] = useState<ReadonlyArray<Session>>([])
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await authClient.listSessions()
    setLoading(false)
    if (result.error !== null) {
      setError(result.error.message ?? "Sessions could not be loaded.")
      return
    }
    setError(undefined)
    setSessions(result.data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SettingsPage
      title="Sessions"
      description="These sessions are owned by the configured authentication engine and resolve to your canonical Company OS User."
    >
      {error === undefined ? null : (
        <div
          role="alert"
          className="flex items-center justify-between border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
        >
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}
      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>IP address</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>Loading sessions…</TableCell>
              </TableRow>
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>No active sessions.</TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <div className="max-w-80 truncate">
                      {session.userAgent ?? "Unknown device"}
                    </div>
                    <Badge variant="outline" className="mt-1">
                      Active
                    </Badge>
                  </TableCell>
                  <TableCell>{session.ipAddress ?? "Unknown"}</TableCell>
                  <TableCell>
                    {new Date(session.expiresAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <ConfirmActionButton
                      actionLabel="Revoke"
                      title="Revoke this session?"
                      description="The browser using this session will need to sign in again."
                      onConfirm={async () => {
                        const result = await authClient.revokeSession({
                          token: session.token,
                        })
                        if (result.error !== null)
                          throw new Error(result.error.message)
                        await load()
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </SettingsPage>
  )
}
