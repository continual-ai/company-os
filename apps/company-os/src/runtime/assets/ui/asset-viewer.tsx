import { Button } from "@company/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@company/ui/dialog"
import { useQuery } from "@tanstack/react-query"
import { DownloadIcon, FileIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { Asset } from "#/runtime/assets/model/asset.ts"
import { assetContentUrl } from "#/runtime/assets/ui/content-url.ts"
import { RecordId, type ImageRef } from "#/runtime/model/index.ts"
import { useObjectClient } from "#/runtime/ui/model/use-object-client.ts"

const assetId = RecordId("asset")

export function AssetPreviewButton({
  reference,
  name,
  children,
}: {
  reference: ImageRef
  name: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="link"
            className="h-auto min-w-0 justify-start p-0 text-left font-normal whitespace-normal"
          />
        }
        aria-label={`Preview ${name}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        aria-describedby={undefined}
      >
        {open && <AssetViewer reference={reference} name={name} />}
      </DialogContent>
    </Dialog>
  )
}

function AssetViewer({
  reference,
  name,
}: {
  reference: ImageRef
  name: string
}) {
  const client = useObjectClient(Asset)
  const asset = useQuery(client.get({ id: assetId(reference.assetId) }))
  const filename = asset.data?.name ?? name
  return (
    <>
      <DialogHeader className="border-b px-4 py-3 pr-12">
        <DialogTitle className="truncate" title={filename}>
          {filename}
        </DialogTitle>
      </DialogHeader>
      <div className="flex min-h-64 min-w-0 flex-1 items-center justify-center overflow-auto bg-muted/40 p-4">
        {asset.isPending ? (
          <output className="text-muted-foreground">Loading preview…</output>
        ) : asset.isError ? (
          <p role="alert" className="text-destructive">
            This file could not be loaded.
          </p>
        ) : (
          <AssetContent
            key={reference.assetId}
            reference={reference}
            name={filename}
            contentType={asset.data.contentType}
          />
        )}
      </div>
      <div className="flex justify-end border-t px-4 py-3">
        <Button
          variant="outline"
          render={
            <a
              href={assetContentUrl(reference.assetId)}
              download={filename}
              aria-label="Download file"
            />
          }
          nativeButton={false}
        >
          <DownloadIcon /> Download
        </Button>
      </div>
    </>
  )
}

function AssetContent({
  reference,
  name,
  contentType,
}: {
  reference: ImageRef
  name: string
  contentType: string
}) {
  const [failed, setFailed] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string>()
  const url = assetContentUrl(reference.assetId)
  useEffect(() => {
    if (contentType !== "application/pdf") return undefined
    const abort = new AbortController()
    let objectUrl: string | undefined
    // The delivery endpoint intentionally downloads documents. Only files identified as PDFs
    // receive a local preview URL; arbitrary uploads are never embedded as HTML.
    void fetch(url, { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("File could not be loaded")
        const bytes = await response.arrayBuffer()
        if (abort.signal.aborted) return
        objectUrl = URL.createObjectURL(
          new Blob([bytes], { type: "application/pdf" })
        )
        setPdfUrl(objectUrl)
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true)
      })
    return () => {
      abort.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [contentType, url])

  if (failed)
    return (
      <p role="alert" className="text-muted-foreground">
        Preview unavailable. You can download the file below.
      </p>
    )
  if (
    ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(contentType)
  )
    return (
      <img
        src={url}
        alt={reference.alt || name}
        className="max-h-[65dvh] max-w-full rounded-sm object-contain"
        onError={() => setFailed(true)}
      />
    )
  if (contentType === "application/pdf")
    return pdfUrl ? (
      <object
        data={pdfUrl}
        type="application/pdf"
        aria-label={name}
        className="h-[65dvh] w-full rounded-sm border-0"
      >
        <p className="text-muted-foreground">
          Your browser cannot preview this PDF. You can download it below.
        </p>
      </object>
    ) : (
      <output className="text-muted-foreground">Loading preview…</output>
    )
  return (
    <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
      <FileIcon className="size-10" />
      <p>No preview available for this file type.</p>
    </div>
  )
}
