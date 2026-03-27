"use client"

import { useEffect, useMemo, useState } from "react"

type ShareButtonProps = {
  path: string
  variant?: "icon" | "full"
}

export default function ShareButton({
  path,
  variant = "full",
}: ShareButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return path
    return `${window.location.origin}${path}`
  }, [path])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("keydown", onEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onEscape)
    }
  }, [open])

  const triggerClassName =
    variant === "icon"
      ? "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50"
      : "btn-secondary w-full"

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        {variant === "icon" ? "↗" : "Compartir torneo"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="relative w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="share-modal-title"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="share-modal-title" className="text-xl font-semibold text-gray-900">
                    Compartir torneo
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Copia este enlace y compártelo donde quieras.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
                >
                  ×
                </button>
              </div>

              <div className="mt-6 flex items-stretch gap-3">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  title="Copiar enlace"
                  className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-100"
                >
                  <span className="block truncate">{shareUrl}</span>
                </button>

                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-indigo-700"
                >
                  Copiar
                </button>
              </div>

              <p className={`mt-3 text-sm ${copied ? "text-green-600" : "text-gray-400"}`}>
                {copied
                  ? "Enlace copiado al portapapeles."
                  : "Pulsa en el enlace o en el botón para copiarlo."}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}