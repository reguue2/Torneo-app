"use client"

import { useState } from "react"

export default function CopyTournamentLinkButton({
  path,
  fullWidth = false,
}: {
  path: string
  fullWidth?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      const origin = window.location.origin
      await navigator.clipboard.writeText(`${origin}${path}`)
      setCopied(true)

      window.setTimeout(() => {
        setCopied(false)
      }, 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 ${
        fullWidth ? "w-full" : "flex-1"
      }`}
    >
      <span>{copied ? "Enlace copiado" : "Copiar enlace"}</span>
    </button>
  )
}