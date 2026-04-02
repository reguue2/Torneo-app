"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatMoney } from "@/lib/tournaments/domain"

type Category = {
  id: string
  name: string
  price: number
  min_participants: number
  max_participants: number | null
  start_at: string | null
  address: string | null
}

type ParticipantType = "individual" | "team"
type RegistrationPaymentMethod = "cash" | "online"

type RegistrationRequestResult = {
  request_id: string
  verification_code: string
  verification_token: string
  expires_at: string
  amount: number
  payment_method: RegistrationPaymentMethod
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
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
  if (message.includes("Team must have at least 2 players")) {
    return "El equipo debe tener al menos 2 jugadores."
  }

  return message
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

export default function RegisterForm({
  tournamentId,
  tournamentTitle,
  hasCategories,
  categories,
  entryPrice,
  paymentMethod,
}: {
  tournamentId: string
  tournamentTitle: string
  hasCategories: boolean
  categories: Category[]
  entryPrice: number
  paymentMethod: "cash" | "online" | "both" | null
}) {
  const supabase = createClient()
  const isDevelopment = process.env.NODE_ENV !== "production"

  const [participantType, setParticipantType] = useState<ParticipantType>("team")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<RegistrationPaymentMethod>(
    paymentMethod === "online" ? "online" : "cash"
  )
  const [categoryId, setCategoryId] = useState<string>(
    hasCategories && categories.length === 1 ? categories[0].id : ""
  )
  const [displayName, setDisplayName] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [playersCount, setPlayersCount] = useState("5")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestResult, setRequestResult] = useState<RegistrationRequestResult | null>(null)

  const selectedCategory = useMemo(() => {
    if (!hasCategories) return null
    return categories.find((category) => category.id === categoryId) ?? null
  }, [hasCategories, categories, categoryId])

  const amount = useMemo(() => {
    if (hasCategories) {
      return selectedCategory ? Number(selectedCategory.price) : null
    }
    return Number(entryPrice)
  }, [hasCategories, selectedCategory, entryPrice])

  const verifyUrl = useMemo(() => {
    if (!requestResult) return ""

    const params = new URLSearchParams({
      request: requestResult.request_id,
      token: requestResult.verification_token,
    })

    return `/inscripcion/verificar?${params.toString()}`
  }, [requestResult])

  const manualVerifyUrl = useMemo(() => {
    if (!requestResult) return ""

    const params = new URLSearchParams({
      request: requestResult.request_id,
    })

    return `/inscripcion/verificar?${params.toString()}`
  }, [requestResult])

  const validate = () => {
    if (hasCategories && !categoryId) {
      return "Debes seleccionar una categoría."
    }

    if (!displayName.trim()) {
      return participantType === "team"
        ? "El nombre del equipo es obligatorio."
        : "El nombre del participante es obligatorio."
    }

    if (!contactPhone.trim()) {
      return "El teléfono de contacto es obligatorio."
    }

    if (!contactEmail.trim()) {
      return "El email de contacto es obligatorio para validar la inscripción."
    }

    if (!isValidEmail(contactEmail.trim())) {
      return "Introduce un email válido."
    }

    if (participantType === "team") {
      const total = Number(playersCount)
      if (!Number.isInteger(total) || total < 2) {
        return "El número de jugadores del equipo debe ser al menos 2."
      }
    }

    return null
  }

  const buildPlayersPayload = () => {
    if (participantType !== "team") return null

    const total = Number(playersCount)

    return Array.from({ length: total }, (_, index) => ({
      slot: index + 1,
    }))
  }

  const resetForm = () => {
    setRequestResult(null)
    setDisplayName("")
    setContactPhone("")
    setContactEmail("")
    setPlayersCount("5")
    setError(null)
    setSelectedPaymentMethod(paymentMethod === "online" ? "online" : "cash")
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)

    const { data, error: rpcError } = await supabase.rpc("create_public_registration_request", {
      p_tournament_id: tournamentId,
      p_category_id: hasCategories ? categoryId || null : null,
      p_participant_type: participantType,
      p_display_name: displayName.trim(),
      p_contact_phone: contactPhone.trim(),
      p_contact_email: contactEmail.trim(),
      p_players: buildPlayersPayload(),
      p_payment_method: selectedPaymentMethod,
    })

    setSubmitting(false)

    if (rpcError) {
      setError(mapErrorMessage(rpcError.message))
      return
    }

    setRequestResult(data as RegistrationRequestResult)
  }

  if (requestResult) {
    const isFree = Number(amount ?? 0) <= 0

    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
          <h3 className="text-lg font-semibold text-green-800">
            Solicitud creada
          </h3>
          <p className="mt-2 text-sm text-green-700">
            Hemos preparado tu solicitud de inscripción. El siguiente paso es validar el email antes de crear la inscripción real.
          </p>
          <p className="mt-2 text-sm text-green-700">
            Caduca el {formatDateTime(requestResult.expires_at)}.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-700">
          <p>
            <span className="font-medium text-gray-900">Torneo:</span>{" "}
            {tournamentTitle}
          </p>
          <p className="mt-2">
            <span className="font-medium text-gray-900">Inscripción:</span>{" "}
            {participantType === "team" ? "Equipo" : "Individual"}
          </p>
          <p className="mt-2">
            <span className="font-medium text-gray-900">Nombre:</span>{" "}
            {displayName}
          </p>
          <p className="mt-2">
            <span className="font-medium text-gray-900">Email:</span>{" "}
            {contactEmail}
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

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-sm text-indigo-900">
          <p className="font-semibold">Verificación del email</p>
          <p className="mt-2">
            En el flujo final esto se enviará por correo. Ahora mismo puedes validar con el enlace directo o entrar en la página de validación manual y pegar el código.
          </p>

          {isDevelopment && (
            <div className="mt-4 space-y-3 rounded-xl border border-indigo-200 bg-white p-4 text-sm">
              <p>
                <span className="font-medium">Código de verificación:</span>{" "}
                {requestResult.verification_code}
              </p>
              <p className="break-all">
                <span className="font-medium">Enlace de verificación:</span>{" "}
                {verifyUrl}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href={verifyUrl} className="btn-primary text-center">
            Validar con enlace
          </Link>
          <Link href={manualVerifyUrl} className="btn-secondary text-center">
            Validar con código
          </Link>
          <Link
            href={`/torneos/${tournamentId}`}
            className="btn-secondary text-center"
          >
            Volver al torneo
          </Link>
          <button
            type="button"
            onClick={resetForm}
            className="btn-secondary"
          >
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
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-medium text-gray-900">
          Método de inscripción
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Primero creas una solicitud, validas el email y solo entonces se genera la inscripción real.
        </p>
      </div>

      <div className="space-y-3">
        <label className="label">
          Tipo de inscripción <span className="text-red-500">*</span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setParticipantType("individual")}
            className={`rounded-2xl border p-4 text-left transition ${
              participantType === "individual"
                ? "border-indigo-600 bg-indigo-50"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <p className="font-medium text-gray-900">Individual</p>
            <p className="mt-1 text-sm text-gray-500">
              Inscripción para una sola persona.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setParticipantType("team")}
            className={`rounded-2xl border p-4 text-left transition ${
              participantType === "team"
                ? "border-indigo-600 bg-indigo-50"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <p className="font-medium text-gray-900">Equipo</p>
            <p className="mt-1 text-sm text-gray-500">
              Inscripción por nombre de equipo y número de jugadores.
            </p>
          </button>
        </div>
      </div>

      {paymentMethod === "both" && (
        <div className="space-y-3">
          <label className="label">
            Canal de pago <span className="text-red-500">*</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedPaymentMethod("cash")}
              className={`rounded-2xl border p-4 text-left transition ${
                selectedPaymentMethod === "cash"
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
              className={`rounded-2xl border p-4 text-left transition ${
                selectedPaymentMethod === "online"
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
      )}

      {hasCategories && (
        <div>
          <label className="label">
            Categoría <span className="text-red-500">*</span>
          </label>
          <select
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Selecciona una categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} · {formatMoney(category.price)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label">
          {participantType === "team" ? "Nombre del equipo" : "Nombre completo"}{" "}
          <span className="text-red-500">*</span>
        </label>
        <input
          className="input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={
            participantType === "team"
              ? "Ej: FC Warriors"
              : "Ej: Diego Martínez"
          }
        />
      </div>

      {participantType === "team" && (
        <div>
          <label className="label">
            Número de jugadores <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={2}
            className="input no-spin"
            value={playersCount}
            onChange={(e) => setPlayersCount(e.target.value)}
            placeholder="Ej: 5"
          />
          <p className="mt-2 text-xs text-gray-500">
            De momento solo pedimos la cantidad. Los nombres de jugadores no se
            solicitan en esta fase.
          </p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label">
            Teléfono de contacto <span className="text-red-500">*</span>
          </label>
          <input
            className="input"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="Ej: 612345678"
          />
        </div>

        <div>
          <label className="label">
            Email de contacto <span className="text-red-500">*</span>
          </label>
          <input
            className="input"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Ej: equipo@correo.com"
          />
          <p className="mt-2 text-xs text-gray-500">
            Lo usamos para validar la solicitud antes de crear la inscripción.
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
            ) : (
              <p>{selectedPaymentMethod === "cash" ? "Pago en efectivo" : "Pago online"}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Creando solicitud..." : "Continuar con la validación"}
        </button>
      </div>
    </form>
  )
}