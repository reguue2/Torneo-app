"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { formatMoney } from "@/lib/tournaments/domain"
import { getSpanishPhoneValidationMessage, normalizeSpanishPhone } from "@/lib/registrations/phone"

type ParticipantType = "individual" | "team"
type RegistrationPaymentMethod = "cash" | "online"
type EmailDeliveryStatus = "sent" | "provider_not_configured" | "provider_error"

type Category = {
  id: string
  name: string
  participant_type: ParticipantType
  price: number
  min_participants: number
  max_participants: number | null
  start_at: string | null
  address: string | null
}

type RegistrationRequestResult = {
  request_id: string
  expires_at: string
  amount: number
  payment_method: RegistrationPaymentMethod
  email_delivery_status: EmailDeliveryStatus
  email_delivery_message: string
}

type ErrorPayload = {
  error?: string
  pending_request_id?: string | null
  expires_at?: string | null
  retry_after_seconds?: number | null
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getInitialPaymentMethod(paymentMethod: "cash" | "online" | "both" | null) {
  return paymentMethod === "online" ? "online" : "cash"
}

function getParticipantTypeLabel(value: ParticipantType | null) {
  if (value === "team") return "Equipos"
  if (value === "individual") return "Individual"
  return "Por definir"
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function mapErrorMessage(message: string) {
  if (message.includes("Display name is required")) {
    return "El nombre es obligatorio."
  }
  if (message.includes("Contact phone is required")) {
    return "El teléfono de contacto es obligatorio."
  }
  if (message.includes("Contact email is required")) {
    return "El email de contacto es obligatorio para validar la inscripción."
  }
  if (message.includes("Category is required")) {
    return "Debes seleccionar una categoría."
  }
  if (message.includes("Category not linked to tournament")) {
    return "La categoría seleccionada no es válida."
  }
  if (message.includes("Tournament participant type is not configured")) {
    return "El organizador todavía no ha configurado el formato de inscripción de este torneo."
  }
  if (message.includes("Category participant type is not configured")) {
    return "La categoría seleccionada todavía no tiene configurado el formato de inscripción."
  }
  if (message.includes("Tournament is not open for registration")) {
    return "Este torneo ya no admite inscripciones."
  }
  if (message.includes("Registration deadline passed")) {
    return "La fecha límite de inscripción ya ha pasado."
  }
  if (message.includes("Tournament is full")) {
    return "Este torneo ya no tiene plazas disponibles."
  }
  if (message.includes("Category is full")) {
    return "Esta categoría ya no tiene plazas disponibles."
  }
  if (message.includes("Only cash registrations are available right now")) {
    return "Este torneo solo admite inscripción en efectivo."
  }
  if (message.includes("Only online registrations are available right now")) {
    return "Este torneo solo admite inscripción online."
  }
  if (message.includes("A registration already exists with this email or phone")) {
    return "Ya existe una inscripción activa con ese email o teléfono."
  }
  if (message.includes("A verification request is already pending for this email or phone")) {
    return "Ya existe una solicitud pendiente de validar con ese email o teléfono."
  }
  if (message.includes("Resend cooldown active")) {
    return "Todavía no puedes reenviar el correo. Espera un poco e inténtalo otra vez."
  }
  if (message.includes("Resend limit reached")) {
    return "Has alcanzado el límite de reenvíos para esta solicitud. Crea una nueva desde la página del torneo."
  }
  if (message.includes("Verification request expired")) {
    return "La solicitud de verificación ha caducado. Crea una nueva desde la página del torneo."
  }

  return message
}

function getDeliveryTone(status: EmailDeliveryStatus) {
  if (status === "sent") {
    return "border-green-200 bg-green-50 text-green-800"
  }

  if (status === "provider_not_configured") {
    return "border-amber-200 bg-amber-50 text-amber-900"
  }

  return "border-red-200 bg-red-50 text-red-800"
}

export default function RegisterForm({
  tournamentId,
  tournamentTitle,
  hasCategories,
  tournamentParticipantType,
  categories,
  entryPrice,
  paymentMethod,
}: {
  tournamentId: string
  tournamentTitle: string
  hasCategories: boolean
  tournamentParticipantType: ParticipantType | null
  categories: Category[]
  entryPrice: number
  paymentMethod: "cash" | "online" | "both" | null
}) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<RegistrationPaymentMethod>(
    getInitialPaymentMethod(paymentMethod)
  )
  const [categoryId, setCategoryId] = useState<string>(
    hasCategories && categories.length === 1 ? categories[0].id : ""
  )
  const [displayName, setDisplayName] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestResult, setRequestResult] = useState<RegistrationRequestResult | null>(null)
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null)
  const [pendingRequestExpiresAt, setPendingRequestExpiresAt] = useState<string | null>(null)
  const [resendFeedback, setResendFeedback] = useState<string | null>(null)

  const selectedCategory = useMemo(() => {
    if (!hasCategories) return null
    return categories.find((category) => category.id === categoryId) ?? null
  }, [hasCategories, categories, categoryId])

  const effectiveParticipantType = useMemo<ParticipantType | null>(() => {
    if (hasCategories) {
      return selectedCategory?.participant_type ?? null
    }

    return tournamentParticipantType
  }, [hasCategories, selectedCategory, tournamentParticipantType])

  const amount = useMemo(() => {
    if (hasCategories) {
      return selectedCategory ? Number(selectedCategory.price) : null
    }
    return Number(entryPrice)
  }, [hasCategories, selectedCategory, entryPrice])

  const validate = () => {
    if (hasCategories && !categoryId) {
      return "Debes seleccionar una categoría."
    }

    if (!effectiveParticipantType) {
      return hasCategories
        ? "La categoría seleccionada todavía no tiene configurado el formato de inscripción."
        : "El organizador todavía no ha configurado el formato de inscripción de este torneo."
    }

    if (!displayName.trim()) {
      return effectiveParticipantType === "team"
        ? "El nombre del equipo es obligatorio."
        : "El nombre del participante es obligatorio."
    }

    const phoneError = getSpanishPhoneValidationMessage(contactPhone)
    if (phoneError) {
      return phoneError
    }

    if (!contactEmail.trim()) {
      return "El email de contacto es obligatorio para validar la inscripción."
    }

    if (!isValidEmail(contactEmail.trim())) {
      return "Introduce un email válido."
    }

    return null
  }

  const resetState = () => {
    setError(null)
    setPendingRequestId(null)
    setPendingRequestExpiresAt(null)
    setResendFeedback(null)
  }

  const resetForm = () => {
    setRequestResult(null)
    setDisplayName("")
    setContactPhone("")
    setContactEmail("")
    setSelectedPaymentMethod(getInitialPaymentMethod(paymentMethod))
    resetState()
  }

  const handleResend = async (requestId = pendingRequestId ?? requestResult?.request_id ?? null) => {
    if (!requestId) return

    setResending(true)
    setError(null)
    setResendFeedback(null)

    try {
      const response = await fetch("/api/public-registration-requests/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId }),
      })

      const payload = (await response.json()) as RegistrationRequestResult | ErrorPayload

      if (!response.ok) {
        const errorPayload = payload as ErrorPayload

        const retryAfter =
          typeof errorPayload.retry_after_seconds === "number"
            ? errorPayload.retry_after_seconds
            : null

        const mapped = mapErrorMessage(
          errorPayload.error ?? "No se pudo reenviar la verificación."
        )

        setError(
          retryAfter !== null
            ? `${mapped} Vuelve a intentarlo en ${retryAfter} segundos.`
            : mapped
        )
        return
      }

      const result = payload as RegistrationRequestResult
      setRequestResult(result)
      setPendingRequestId(result.request_id)
      setPendingRequestExpiresAt(result.expires_at)
      setResendFeedback(
        result.email_delivery_status === "sent"
          ? "Te hemos reenviado el correo de verificación."
          : result.email_delivery_message
      )
    } catch {
      setError("No se pudo reenviar la verificación.")
    } finally {
      setResending(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetState()

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch("/api/public-registration-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tournamentId,
          categoryId: hasCategories ? categoryId || null : null,
          displayName: displayName.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim(),
          paymentMethod: selectedPaymentMethod,
        }),
      })

      const payload = (await response.json()) as RegistrationRequestResult | ErrorPayload

      if (!response.ok) {
        const errorPayload = payload as ErrorPayload

        setError(
          mapErrorMessage(errorPayload.error ?? "No se pudo crear la solicitud.")
        )
        setPendingRequestId(errorPayload.pending_request_id ?? null)
        setPendingRequestExpiresAt(errorPayload.expires_at ?? null)
        return
      }

      const result = payload as RegistrationRequestResult
      setRequestResult(result)
      setPendingRequestId(result.request_id)
      setPendingRequestExpiresAt(result.expires_at)
    } catch {
      setError("No se pudo crear la solicitud de inscripción.")
    } finally {
      setSubmitting(false)
    }
  }

  const canOfferResend = Boolean(pendingRequestId)

  if (requestResult) {
    const isFree = Number(amount ?? 0) <= 0

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
          <h3 className="text-lg font-semibold text-green-800">Solicitud creada</h3>
          <p className="mt-2 text-sm text-green-700">
            Hemos preparado tu solicitud de inscripción. El siguiente paso es validar el
            email antes de crear la inscripción real.
          </p>
          <p className="mt-2 text-sm text-green-700">
            Caduca el {formatDateTime(requestResult.expires_at)}.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-700">
          <p>
            <span className="font-medium text-gray-900">Torneo:</span> {tournamentTitle}
          </p>
          <p className="mt-2">
            <span className="font-medium text-gray-900">Formato:</span>{" "}
            {getParticipantTypeLabel(effectiveParticipantType)}
          </p>
          {selectedCategory && (
            <p className="mt-2">
              <span className="font-medium text-gray-900">Categoría:</span> {selectedCategory.name}
            </p>
          )}
          <p className="mt-2">
            <span className="font-medium text-gray-900">Nombre:</span> {displayName}
          </p>
          <p className="mt-2">
            <span className="font-medium text-gray-900">Email:</span> {contactEmail}
          </p>
          <p className="mt-2">
            <span className="font-medium text-gray-900">Teléfono:</span>{" "}
            {normalizeSpanishPhone(contactPhone) ?? contactPhone}
          </p>
          <p className="mt-2">
            <span className="font-medium text-gray-900">Importe:</span>{" "}
            {amount === null ? "Selecciona categoría" : formatMoney(amount)}
          </p>
          <p className="mt-2">
            <span className="font-medium text-gray-900">Canal de pago:</span>{" "}
            {requestResult.payment_method === "cash" ? "Efectivo" : "Online"}
          </p>
          <p className="mt-2">
            <span className="font-medium text-gray-900">Qué pasará al verificar:</span>{" "}
            {isFree
              ? "La inscripción quedará confirmada automáticamente."
              : requestResult.payment_method === "cash"
                ? "La inscripción quedará creada y pendiente de validación manual del organizador."
                : "La inscripción quedará creada y pendiente del flujo de pago online."}
          </p>
        </div>

        <div className={`rounded-2xl border p-5 text-sm ${getDeliveryTone(requestResult.email_delivery_status)}`}>
          <p className="font-semibold">
            {requestResult.email_delivery_status === "sent"
              ? "Correo de verificación enviado"
              : requestResult.email_delivery_status === "provider_not_configured"
                ? "Proveedor de correo pendiente de terminar"
                : "El correo no se pudo enviar"}
          </p>
          <p className="mt-2">{requestResult.email_delivery_message}</p>
          {resendFeedback && <p className="mt-2">{resendFeedback}</p>}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void handleResend(requestResult.request_id)}
              disabled={resending}
              className="btn-secondary"
            >
              {resending ? "Reenviando..." : "Reenviar correo de verificación"}
            </button>
            <Link
              href={`/inscripcion/verificar?request=${encodeURIComponent(requestResult.request_id)}`}
              className="btn-secondary text-center"
            >
              Ir a validación manual
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href={`/torneos/${tournamentId}`} className="btn-secondary text-center">
            Volver al torneo
          </Link>
          <button type="button" onClick={resetForm} className="btn-secondary">
            Crear otra solicitud
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          {pendingRequestExpiresAt && (
            <p className="mt-2">La solicitud pendiente caduca el {formatDateTime(pendingRequestExpiresAt)}.</p>
          )}
        </div>
      )}

      {canOfferResend && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Ya hay una solicitud pendiente</p>
          <p className="mt-2">
            No vamos a crear otra igual mientras siga activa. Puedes reenviar el correo de
            verificación de esa solicitud.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resending}
              className="btn-secondary"
            >
              {resending ? "Reenviando..." : "Reenviar correo"}
            </button>
            <Link
              href={`/inscripcion/verificar?request=${encodeURIComponent(pendingRequestId ?? "")}`}
              className="btn-secondary text-center"
            >
              Ir a validación manual
            </Link>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-medium text-gray-900">Cómo funciona la inscripción</p>
        <p className="mt-1 text-sm text-gray-600">
          Primero creas una solicitud y solo después, cuando el email esté verificado, se
          genera la inscripción real.
        </p>
      </div>

      {paymentMethod === "both" ? (
        <div className="space-y-3">
          <label className="label">
            Canal de pago <span className="text-red-500">*</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedPaymentMethod("cash")}
              className={`rounded-2xl border p-4 text-left transition ${selectedPaymentMethod === "cash"
                ? "border-indigo-600 bg-indigo-50"
                : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
            >
              <p className="font-medium text-gray-900">Efectivo</p>
              <p className="mt-1 text-sm text-gray-500">
                El organizador validará manualmente el cobro.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedPaymentMethod("online")}
              className={`rounded-2xl border p-4 text-left transition ${selectedPaymentMethod === "online"
                ? "border-indigo-600 bg-indigo-50"
                : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
            >
              <p className="font-medium text-gray-900">Online</p>
              <p className="mt-1 text-sm text-gray-500">
                Quedará preparada para el flujo online cuando esté conectado.
              </p>
            </button>
          </div>
        </div>
      ) : paymentMethod ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
          <p>
            <span className="font-medium text-gray-900">Canal de pago configurado:</span>{" "}
            {paymentMethod === "cash" ? "Solo efectivo" : "Solo online"}
          </p>
        </div>
      ) : null}

      {hasCategories && (
        <div className="space-y-3">
          <label className="label">
            Categoría <span className="text-red-500">*</span>
          </label>
          <select
            className="input"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Selecciona una categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} · {getParticipantTypeLabel(category.participant_type)} · {formatMoney(category.price)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
        <p>
          <span className="font-medium text-gray-900">Formato de inscripción:</span>{" "}
          {getParticipantTypeLabel(effectiveParticipantType)}
        </p>
        <p className="mt-2 text-gray-500">
          {effectiveParticipantType === "team"
            ? "Esta inscripción representa a un equipo. Solo pediremos el nombre del equipo y el contacto de quien realiza la inscripción."
            : effectiveParticipantType === "individual"
              ? "Esta inscripción representa a una sola persona."
              : hasCategories
                ? "Selecciona una categoría para ver qué formato de inscripción aplica."
                : "El organizador todavía no ha configurado el formato de inscripción."}
        </p>
      </div>

      <div>
        <label className="label">
          {effectiveParticipantType === "team" ? "Nombre del equipo" : "Nombre completo"}{" "}
          <span className="text-red-500">*</span>
        </label>
        <input
          className="input"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder={
            effectiveParticipantType === "team" ? "Ej: FC Warriors" : "Ej: Diego Martínez"
          }
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label">
            Teléfono de contacto <span className="text-red-500">*</span>
          </label>
          <input
            className="input"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="Ej: 612345678 o +34 612 345 678"
            autoComplete="tel"
          />
          <p className="mt-2 text-xs text-gray-500">
            Solo aceptamos teléfonos españoles válidos.
          </p>
        </div>

        <div>
          <label className="label">
            Email de contacto <span className="text-red-500">*</span>
          </label>
          <input
            className="input"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            placeholder={
              effectiveParticipantType === "team" ? "Ej: equipo@correo.com" : "Ej: jugador@correo.com"
            }
            autoComplete="email"
          />
          <p className="mt-2 text-xs text-gray-500">
            Lo usamos para validar la solicitud y enviarte después la referencia de la inscripción.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Importe</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {amount === null ? "Selecciona categoría" : formatMoney(amount)}
            </p>
          </div>

          <div className="text-right text-sm text-gray-500">
            {amount !== null && Number(amount) <= 0 ? (
              <p>Inscripción gratuita</p>
            ) : selectedPaymentMethod === "cash" ? (
              <p>Pago en efectivo con validación manual</p>
            ) : (
              <p>Pago online pendiente de integración completa</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Creando solicitud..." : "Crear solicitud"}
        </button>
        <Link href={`/torneos/${tournamentId}`} className="btn-secondary text-center">
          Volver al torneo
        </Link>
      </div>
    </form>
  )
}
