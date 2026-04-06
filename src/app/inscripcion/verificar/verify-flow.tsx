"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { formatMoney } from "@/lib/tournaments/domain"

type SubmitMode = "token" | "code"
type FlowStatus = "idle" | "submitting" | "success" | "error"
type EmailDeliveryStatus = "sent" | "provider_not_configured" | "provider_error" | null

type VerificationResult = {
  already_verified: boolean
  public_reference: string | null
  registration_status: string | null
  payment_method: "cash" | "online" | null
  amount: number | null
  cancel_code: string | null
  cancel_token: string | null
  email_delivery_status: EmailDeliveryStatus
  email_delivery_message: string | null
}

type ErrorPayload = {
  error?: string
}

type Props = {
  initialRequestId: string
  initialToken: string
  initialCode: string
}

function mapErrorMessage(message: string) {
  if (message.includes("Verification request not found")) {
    return "No hemos encontrado la solicitud de verificación."
  }

  if (message.includes("Verification request expired")) {
    return "La solicitud de verificación ha caducado. Tendrás que crear una nueva desde la página del torneo."
  }

  if (
    message.includes("Invalid verification token") ||
    message.includes("Invalid verification code")
  ) {
    return "El enlace o el código de verificación no son válidos."
  }

  if (message.includes("Tournament is not open for registration")) {
    return "El torneo ya no admite inscripciones."
  }

  if (message.includes("Registration deadline passed")) {
    return "La fecha límite de inscripción ya ha pasado."
  }

  if (message.includes("A registration already exists with this email or phone")) {
    return "Ya existe una inscripción activa con ese email o teléfono."
  }

  return message
}

function getStatusLabel(status: string | null | undefined) {
  if (status === "confirmed") return "Confirmada"
  if (status === "pending_cash_validation") {
    return "Pendiente de validación en efectivo"
  }
  if (status === "pending_online_payment") return "Pendiente de pago online"
  if (status === "cancelled") return "Cancelada"
  return status ?? "—"
}

function getNextStepMessage(result: VerificationResult) {
  if ((result.amount ?? 0) <= 0 || result.registration_status === "confirmed") {
    return "La inscripción ya queda operativa. Guarda la referencia pública y los datos de cancelación."
  }

  if (result.registration_status === "pending_cash_validation") {
    return "La inscripción ya existe, pero el organizador tendrá que validar manualmente el pago en efectivo."
  }

  if (result.registration_status === "pending_online_payment") {
    return "La inscripción ya existe. Mientras el pago online siga simulado, el organizador podrá confirmarlo desde su panel."
  }

  return "La solicitud ya está validada y la inscripción real se ha creado correctamente."
}

function getDeliveryTone(status: EmailDeliveryStatus) {
  if (status === "sent") {
    return "border-green-200 bg-green-50 text-green-800"
  }

  if (status === "provider_not_configured") {
    return "border-amber-200 bg-amber-50 text-amber-900"
  }

  if (status === "provider_error") {
    return "border-red-200 bg-red-50 text-red-800"
  }

  return "border-gray-200 bg-gray-50 text-gray-700"
}

export default function VerifyFlow({
  initialRequestId,
  initialToken,
  initialCode,
}: Props) {
  const [requestId, setRequestId] = useState(initialRequestId)
  const token = initialToken
  const [code, setCode] = useState(initialCode)
  const [flowStatus, setFlowStatus] = useState<FlowStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VerificationResult | null>(null)

  const hasLinkAccess = Boolean(token)
  const canSubmitWithCode = requestId.trim() !== "" && code.trim() !== ""

  const cancelUrl = useMemo(() => {
    if (!result?.public_reference || !result.cancel_token) return null

    const params = new URLSearchParams({
      reference: result.public_reference,
      token: result.cancel_token,
    })

    return `/inscripcion/cancelar?${params.toString()}`
  }, [result])

  const submitVerification = async (mode: SubmitMode) => {
    if (mode === "token" && !token) return
    if (mode === "code" && !canSubmitWithCode) return

    setFlowStatus("submitting")
    setError(null)

    try {
      const response = await fetch("/api/public-registration-verifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: requestId.trim(),
          verificationToken: mode === "token" ? token : undefined,
          verificationCode: mode === "code" ? code.trim() : undefined,
        }),
      })

      const payload = (await response.json()) as VerificationResult | ErrorPayload

      if (!response.ok) {
        const errorPayload = payload as ErrorPayload

        setFlowStatus("error")
        setError(
          mapErrorMessage(errorPayload.error ?? "No se pudo validar la solicitud.")
        )
        return
      }

      setResult(payload as VerificationResult)
      setFlowStatus("success")
    } catch {
      setFlowStatus("error")
      setError("No se pudo validar la solicitud.")
    }
  }

  if (flowStatus === "success" && result) {
    return (
      <div className="card space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {result.already_verified ? "Inscripción ya verificada" : "Inscripción creada"}
          </h1>
          <p className="mt-2 text-gray-600">{getNextStepMessage(result)}</p>
        </div>

        <div className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-700 sm:grid-cols-2">
          <div>
            <p className="text-gray-500">Referencia pública</p>
            <p className="mt-1 font-semibold text-gray-900">{result.public_reference ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">Estado</p>
            <p className="mt-1 font-semibold text-gray-900">
              {getStatusLabel(result.registration_status)}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Canal de pago</p>
            <p className="mt-1 font-semibold text-gray-900">
              {result.payment_method === "cash"
                ? "Efectivo"
                : result.payment_method === "online"
                  ? "Online"
                  : "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Importe</p>
            <p className="mt-1 font-semibold text-gray-900">
              {formatMoney(result.amount ?? null)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-sm text-indigo-900">
          <p className="font-semibold">Cancelación pública</p>
          <p className="mt-2">
            Guarda la referencia y el acceso de cancelación. No dependes del organizador para
            anular la inscripción.
          </p>
          {cancelUrl && (
            <p className="mt-3 break-all">
              <span className="font-medium">Enlace de cancelación:</span> {cancelUrl}
            </p>
          )}
          {result.cancel_code && (
            <p className="mt-3">
              <span className="font-medium">Código de cancelación:</span> {result.cancel_code}
            </p>
          )}
        </div>

        {!result.already_verified && result.email_delivery_message && (
          <div className={`rounded-2xl border p-5 text-sm ${getDeliveryTone(result.email_delivery_status)}`}>
            <p className="font-semibold">
              {result.email_delivery_status === "sent"
                ? "Correo de confirmación enviado"
                : result.email_delivery_status === "provider_not_configured"
                  ? "Inscripción creada, pero falta terminar el proveedor de correo"
                  : result.email_delivery_status === "provider_error"
                    ? "La inscripción se ha creado, pero el correo de confirmación ha fallado"
                    : "Estado del correo"}
            </p>
            <p className="mt-2">{result.email_delivery_message}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/explorar" className="btn-secondary text-center">
            Volver a explorar
          </Link>
          {cancelUrl && (
            <Link href={cancelUrl} className="btn-primary text-center">
              Ir a cancelación
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="card space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Validar inscripción</h1>
        <p className="mt-2 text-gray-600">
          Puedes validar con el enlace recibido por correo o pegando manualmente el
          identificador de solicitud y el código que llegue en ese mensaje.
        </p>
      </div>

      {flowStatus === "submitting" && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-700">
          Validando la solicitud...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {hasLinkAccess ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">Acceso por enlace</p>
          <p className="mt-2">
            El enlace ya incluye el token. Aquí confirmas explícitamente la validación antes de
            crear la inscripción real.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void submitVerification("token")}
              disabled={flowStatus === "submitting"}
              className="btn-primary"
            >
              {flowStatus === "submitting" ? "Validando..." : "Validar con enlace"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div>
          <p className="font-semibold text-gray-900">Validación manual por código</p>
          <p className="mt-2 text-sm text-gray-600">
            Úsalo si no tienes el enlace completo pero sí el identificador de solicitud y el
            código recibido por correo.
          </p>
        </div>

        <div>
          <label className="label">Identificador de solicitud</label>
          <input
            className="input mt-2"
            value={requestId}
            onChange={(event) => setRequestId(event.target.value)}
            placeholder="UUID de la solicitud"
          />
        </div>

        <div>
          <label className="label">Código de verificación</label>
          <input
            className="input mt-2"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Código recibido"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void submitVerification("code")}
            disabled={flowStatus === "submitting" || !canSubmitWithCode}
            className="btn-primary"
          >
            {flowStatus === "submitting" ? "Validando..." : "Validar con código"}
          </button>
          <Link href="/explorar" className="btn-secondary text-center">
            Volver a explorar
          </Link>
        </div>
      </div>
    </div>
  )
}
