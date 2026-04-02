"use client"

import Link from "next/link"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database"

type CancelResult =
  Database["public"]["Functions"]["cancel_public_registration"]["Returns"]

type Props = {
  initialReference: string
  initialToken: string
  initialCode: string
}

type FlowStatus = "idle" | "submitting" | "success" | "error"

function mapErrorMessage(message: string) {
  if (message.includes("Registration not found")) {
    return "No hemos encontrado la inscripción."
  }
  if (message.includes("Invalid cancel token") || message.includes("Invalid cancel code")) {
    return "El enlace o el código de cancelación no son válidos."
  }

  return message
}

export default function CancelFlow({
  initialReference,
  initialToken,
  initialCode,
}: Props) {
  const supabase = createClient()

  const [reference, setReference] = useState(initialReference)
  const token = initialToken
  const [code, setCode] = useState(initialCode)
  const [flowStatus, setFlowStatus] = useState<FlowStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CancelResult | null>(null)

  const hasLinkAccess = Boolean(token)
  const canSubmitWithCode = reference.trim() !== "" && code.trim() !== ""
  const canSubmitWithToken = reference.trim() !== "" && token.trim() !== ""

  const submitCancellation = async (mode: "token" | "code") => {
    if (mode === "token" && !canSubmitWithToken) return
    if (mode === "code" && !canSubmitWithCode) return

    setFlowStatus("submitting")
    setError(null)

    const { data, error: rpcError } = await supabase.rpc(
      "cancel_public_registration",
      {
        p_public_reference: reference.trim(),
        p_cancel_token: mode === "token" ? token.trim() : null,
        p_cancel_code: mode === "code" ? code.trim() : null,
      }
    )

    if (rpcError) {
      setFlowStatus("error")
      setError(mapErrorMessage(rpcError.message))
      return
    }

    setResult(data)
    setFlowStatus("success")
  }

  if (flowStatus === "success" && result) {
    return (
      <div className="card space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {result.already_cancelled ? "Inscripción ya cancelada" : "Inscripción cancelada"}
          </h1>
          <p className="mt-2 text-gray-600">
            {result.already_cancelled
              ? "Esta inscripción ya estaba cancelada."
              : "La inscripción se ha cancelado correctamente."}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-700">
          <p>
            <span className="font-medium text-gray-900">Referencia:</span>{" "}
            {result.public_reference ?? reference}
          </p>
          <p className="mt-2">
            <span className="font-medium text-gray-900">Estado:</span>{" "}
            {result.status ?? "cancelled"}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/explorar" className="btn-primary text-center">
            Volver a explorar torneos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="card space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cancelar inscripción</h1>
        <p className="mt-2 text-gray-600">
          La cancelación ya no se ejecuta al abrir el enlace. Aquí la confirmas de forma explícita.
        </p>
      </div>

      {flowStatus === "submitting" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Cancelando inscripción...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {hasLinkAccess ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <div>
            <p className="font-semibold text-gray-900">Acceso por enlace</p>
            <p className="mt-2 text-sm text-gray-600">
              Abrir el enlace no cancela nada por sí solo. Tienes que confirmarlo aquí.
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Referencia</p>
            <p className="mt-1 font-medium text-gray-900">{reference || "—"}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void submitCancellation("token")}
              disabled={flowStatus === "submitting" || !canSubmitWithToken}
              className="rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {flowStatus === "submitting" ? "Cancelando..." : "Confirmar cancelación"}
            </button>
            <Link href="/explorar" className="btn-secondary text-center">
              No cancelar
            </Link>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div>
          <p className="font-semibold text-gray-900">Cancelación manual por código</p>
          <p className="mt-2 text-sm text-gray-600">
            Úsalo si tienes la referencia pública y el código, pero no el enlace completo.
          </p>
        </div>

        <div>
          <label className="label">Referencia pública</label>
          <input
            className="input mt-2"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Referencia pública"
          />
        </div>

        <div>
          <label className="label">Código de cancelación</label>
          <input
            className="input mt-2"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Código de cancelación"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void submitCancellation("code")}
            disabled={flowStatus === "submitting" || !canSubmitWithCode}
            className="rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {flowStatus === "submitting" ? "Cancelando..." : "Cancelar con código"}
          </button>
          <Link href="/explorar" className="btn-secondary text-center">
            Volver a explorar
          </Link>
        </div>
      </div>
    </div>
  )
}