import { FileIcon, UploadIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { type FileRef, type ImageRef } from "#/model/index.ts"
import { ROOT_ID } from "#/model/system-records.ts"
import { assetContentUrl } from "#/ui/assets/content-url.ts"
import { useAssetNames } from "#/ui/assets/use-asset-names.ts"
import { Button } from "#/ui/components/button.tsx"
import { Input } from "#/ui/components/input.tsx"
import { formErrorFromCause } from "#/ui/forms/form-errors.ts"
import { useModelRuntime } from "#/ui/model/runtime-context.tsx"

export function FileField({
  id,
  value,
  image = false,
  multiple = false,
  maxBytes = 25_000_000,
  accept,
  scope = ROOT_ID,
  onChange,
  onPendingChange,
}: {
  readonly id: string
  readonly value: ReadonlyArray<ImageRef>
  readonly image?: boolean
  readonly multiple?: boolean
  readonly maxBytes?: number | undefined
  readonly accept?: ReadonlyArray<string> | undefined
  readonly scope?: string | undefined
  readonly onChange: (value: ReadonlyArray<ImageRef>) => void
  readonly onPendingChange: (pending: boolean) => void
}) {
  const runtime = useModelRuntime()

  const [pending, setPending] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string>()
  const names = useAssetNames(value)
  const controller = useRef<AbortController | undefined>(undefined)
  const [retryFile, setRetryFile] = useState<File>()
  const currentValue = useRef(value)
  useEffect(() => {
    currentValue.current = value
  }, [value])

  useEffect(() => () => controller.current?.abort(), [])

  const upload = async (files: ReadonlyArray<File>) => {
    if (pending || files.length === 0) return
    const selected = multiple ? files : files.slice(0, 1)
    if (selected.some((file) => file.size === 0 || file.size > maxBytes)) {
      setError(
        `Choose files between 1 byte and ${Math.round(maxBytes / 1_000_000)} MB.`
      )
      return
    }
    const abort = new AbortController()
    controller.current = abort
    setPending(true)
    onPendingChange(true)
    setError(undefined)
    try {
      for (const file of selected) {
        setRetryFile(file)
        setProgress(0)
        const reference: FileRef = await runtime.uploadAsset(
          file,
          scope,
          abort.signal,
          setProgress
        )
        const next = multiple
          ? [...currentValue.current, reference]
          : [reference]
        currentValue.current = next
        onChange(next)
      }
      setRetryFile(undefined)
    } catch (cause) {
      if (!abort.signal.aborted) {
        const errors = formErrorFromCause(cause, "The upload failed.")
        setError(
          errors.form?.[0]?.message ??
            Object.values(errors.fields)[0]?.[0]?.message ??
            "The upload failed."
        )
      }
    } finally {
      if (!abort.signal.aborted) {
        setPending(false)
        onPendingChange(false)
      }
    }
  }

  return (
    <div
      className="space-y-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        void upload(Array.from(event.dataTransfer.files))
      }}
    >
      {value.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {value.map((reference, index) => (
            <div
              key={`${reference.assetId}-${index}`}
              className="flex items-start gap-2 rounded-md border p-2"
            >
              <a
                href={assetContentUrl(reference.assetId)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm"
              >
                {image ? (
                  <img
                    src={assetContentUrl(reference.assetId)}
                    alt={reference.alt ?? ""}
                    width={80}
                    height={80}
                    className="size-20 rounded-sm object-cover"
                  />
                ) : (
                  <FileIcon className="size-4" />
                )}
                {!image && (names.get(reference.assetId) ?? "Download file")}
              </a>
              {image && (
                <Input
                  aria-label="Alternative text"
                  placeholder="Describe the image"
                  value={reference.alt ?? ""}
                  onChange={(event) =>
                    onChange(
                      value.map((item, i) =>
                        i === index
                          ? { ...item, alt: event.currentTarget.value }
                          : item
                      )
                    )
                  }
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Remove attachment"
                disabled={pending}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <XIcon />
              </Button>
            </div>
          ))}
        </div>
      )}
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground"
      >
        <UploadIcon className="size-4" />
        {pending
          ? `Uploading ${progress}%`
          : multiple
            ? "Choose or drop files"
            : "Choose or drop a file"}
        <input
          id={id}
          type="file"
          className="sr-only"
          disabled={pending}
          multiple={multiple}
          accept={(
            accept ??
            (image
              ? ["image/png", "image/jpeg", "image/webp", "image/gif"]
              : [])
          ).join(",")}
          onChange={(event) => {
            void upload(Array.from(event.currentTarget.files ?? []))
            event.currentTarget.value = ""
          }}
        />
      </label>
      {pending && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            controller.current?.abort()
            setPending(false)
            onPendingChange(false)
          }}
        >
          Cancel upload
        </Button>
      )}
      {error && (
        <div role="alert" className="text-sm text-destructive">
          {error}
          {retryFile && (
            <Button
              type="button"
              variant="link"
              onClick={() => void upload([retryFile])}
            >
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
