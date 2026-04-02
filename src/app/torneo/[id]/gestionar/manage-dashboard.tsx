"use client"

import Link from "next/link"
import { useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"
import type {
  CategoryRow,
  ParticipantRow,
  PaymentRow,
  RegistrationRow,
  RegistrationStatus,
  TournamentRow,
  TournamentStatus,
} from "@/lib/tournaments/management"
import {
  ACTIVE_REGISTRATION_STATUSES,
  CANCELLABLE_BY_ORGANIZER_STATUSES,
  CONFIRMABLE_ONLINE_STATUSES,
  PENDING_MANUAL_REVIEW_STATUSES,
} from "@/lib/tournaments/management"

type RegistrationView = {
  registration: RegistrationRow
  participant: ParticipantRow | null
  category: CategoryRow | null
  payment: PaymentRow | null
  amount: number
  playersCount: number | null
}

type ConfigForm = {
  title: string
  description: string
  rules: string
  province: string
  address: string
  date: string
  registration_deadline: string
  is_public: boolean
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ""
  const normalized = value.includes("T") ? value : value.replace(" ", "T")
  return normalized.slice(0, 16)
}

function formatDate(value: string | null) {
  if (!value) return "Fecha por definir"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Fecha por definir"
  return date.toLocaleDateString("es-ES")
}

function formatDateTime(value: string | null) {
  if (!value) return "—"
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

function formatMoney(value: number | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return "—"
  if (amount === 0) return "0€"
  const text = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2).replace(/\.00$/, "")
  return `${text}€`
}

function countPlayers(players: unknown) {
  if (!Array.isArray(players)) return null
  return players.length
}

function getRegistrationAmount(
  registration: RegistrationRow,
  tournament: TournamentRow,
  category: CategoryRow | null
) {
  if (registration.category_id) return Number(category?.price ?? 0)
  return Number(tournament.entry_price ?? 0)
}

function getCapacityForTournament(tournament: TournamentRow, categories: CategoryRow[]) {
  if (!tournament.has_categories) return tournament.max_participants
  if (categories.length === 0) return null
  if (categories.some((category) => category.max_participants === null)) return null
  return categories.reduce((acc, category) => acc + (category.max_participants ?? 0), 0)
}

function canReopenTournament(tournament: TournamentRow) {
  if (tournament.status !== "closed") return false
  if (!tournament.registration_deadline) return true

  const deadline = new Date(tournament.registration_deadline)
  if (Number.isNaN(deadline.getTime())) return true

  return deadline > new Date()
}

function isActiveRegistration(status: RegistrationStatus | null) {
  if (!status) return false
  return ACTIVE_REGISTRATION_STATUSES.includes(status)
}

function isConfirmedRegistration(status: RegistrationStatus | null) {
  return status === "confirmed" || status === "paid"
}

function needsCashValidation(view: RegistrationView) {
  return (
    view.registration.payment_method === "cash" &&
    view.registration.status !== null &&
    PENDING_MANUAL_REVIEW_STATUSES.includes(view.registration.status)
  )
}

function needsOnlineValidation(view: RegistrationView) {
  return (
    view.registration.payment_method === "online" &&
    view.registration.status !== null &&
    CONFIRMABLE_ONLINE_STATUSES.includes(view.registration.status)
  )
}

function canCancelFromDashboard(status: RegistrationStatus | null) {
  if (!status) return false
  return CANCELLABLE_BY_ORGANIZER_STATUSES.includes(status)
}

function getStatusBadge(status: TournamentStatus | null) {
  if (status === "published") {
    return "bg-green-100 text-green-700 border border-green-200"
  }
  if (status === "closed") {
    return "bg-amber-100 text-amber-700 border border-amber-200"
  }
  if (status === "finished") {
    return "bg-blue-100 text-blue-700 border border-blue-200"
  }
  if (status === "cancelled") {
    return "bg-red-100 text-red-700 border border-red-200"
  }
  return "bg-gray-100 text-gray-700 border border-gray-200"
}

function getStatusLabel(status: TournamentStatus | null) {
  if (status === "published") return "Publicado"
  if (status === "closed") return "Cerrado"
  if (status === "finished") return "Finalizado"
  if (status === "cancelled") return "Cancelado"
  return "Borrador"
}

function getRegistrationStatusBadge(view: RegistrationView) {
  if (view.registration.status === "confirmed" || view.registration.status === "paid") {
    return "bg-green-100 text-green-700 border border-green-200"
  }
  if (
    view.registration.status === "pending_cash_validation" ||
    view.registration.status === "pending"
  ) {
    return "bg-amber-50 text-amber-700 border border-amber-200"
  }
  if (view.registration.status === "pending_online_payment") {
    return "bg-indigo-50 text-indigo-700 border border-indigo-200"
  }
  if (view.registration.status === "expired") {
    return "bg-gray-100 text-gray-700 border border-gray-200"
  }
  if (view.registration.status === "cancelled") {
    return "bg-red-100 text-red-700 border border-red-200"
  }
  return "bg-gray-100 text-gray-700 border border-gray-200"
}

function getRegistrationStatusLabel(view: RegistrationView) {
  if (view.registration.status === "confirmed") return "Confirmada"
  if (view.registration.status === "paid") return "Pagada (legacy)"
  if (view.registration.status === "pending_cash_validation") {
    return "Pendiente de validación en efectivo"
  }
  if (view.registration.status === "pending_online_payment") {
    return "Pendiente de pago online"
  }
  if (view.registration.status === "pending") return "Pendiente (legacy)"
  if (view.registration.status === "expired") return "Caducada"
  if (view.registration.status === "cancelled") return "Cancelada"
  if (view.registration.payment_method === "online") return "Pendiente online"
  return "Pendiente"
}

function getPaymentMethodLabel(method: RegistrationRow["payment_method"]) {
  if (method === "cash") return "Efectivo"
  if (method === "online") return "Online"
  return "Por definir"
}

function getPaymentStatusLabel(view: RegistrationView) {
  if (view.payment?.status === "paid") return "Cobrado"
  if (view.payment?.status === "refunded") return "Reembolsado"
  if (view.payment?.status === "pending") return "Pendiente"
  if (needsOnlineValidation(view)) return "Pendiente de confirmar"
  return "Sin movimiento"
}

function mapManagementError(message: string) {
  if (message.includes("You cannot manage this tournament")) {
    return "No puedes gestionar este torneo."
  }
  if (message.includes("Only closed tournaments can be reopened")) {
    return "Solo puedes reabrir torneos cerrados."
  }
  if (message.includes("Registration deadline already passed")) {
    return "No puedes reabrir inscripciones porque la fecha límite ya ha pasado."
  }
  if (message.includes("Only published tournaments can be closed")) {
    return "Solo puedes cerrar torneos publicados."
  }
  if (message.includes("Only published or closed tournaments can be finished")) {
    return "Solo puedes finalizar torneos publicados o cerrados."
  }
  if (message.includes("Only published or closed tournaments can be cancelled")) {
    return "Solo puedes cancelar torneos publicados o cerrados."
  }
  if (message.includes("Draft tournaments must be managed from the creation flow")) {
    return "Los borradores se gestionan desde el flujo de creación."
  }
  if (message.includes("You cannot manage this registration")) {
    return "No puedes gestionar esta inscripción."
  }
  if (message.includes("Only cash registrations can be marked as paid manually")) {
    return "Solo puedes validar manualmente una inscripción en efectivo."
  }
  if (message.includes("Only pending registrations can be marked as paid")) {
    return "Solo puedes validar inscripciones pendientes."
  }
  if (message.includes("Only online registrations can be marked as paid manually")) {
    return "Solo puedes confirmar manualmente pagos online simulados."
  }
  if (message.includes("Only online pending registrations can be marked as paid")) {
    return "Solo puedes confirmar pagos online que sigan pendientes."
  }
  if (message.includes("Only pending registrations can be cancelled")) {
    return "Solo puedes cancelar inscripciones pendientes."
  }
  return message
}

function StatCard({
  title,
  value,
  icon,
  iconClassName,
}: {
  title: string
  value: string
  icon: ReactNode
  iconClassName: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconClassName}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string
  description?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="card space-y-5 rounded-2xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function ManageDashboard({
  tournament,
  categories,
  registrations,
  participants,
  payments,
}: {
  tournament: TournamentRow
  categories: CategoryRow[]
  registrations: RegistrationRow[]
  participants: ParticipantRow[]
  payments: PaymentRow[]
}) {
  const supabase = createClient()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<"participants" | "config">("participants")
  const [busy, setBusy] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [copyOk, setCopyOk] = useState(false)
  const [form, setForm] = useState<ConfigForm>({
    title: tournament.title,
    description: tournament.description ?? "",
    rules: tournament.rules ?? "",
    province: tournament.province ?? "",
    address: tournament.address ?? "",
    date: toDateTimeLocal(tournament.date),
    registration_deadline: toDateTimeLocal(tournament.registration_deadline),
    is_public: tournament.is_public ?? true,
  })

  const participantMap = useMemo(
    () => new Map(participants.map((participant) => [participant.id, participant])),
    [participants]
  )

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )

  const paymentsByRegistration = useMemo(() => {
    const map = new Map<string, PaymentRow[]>()
    for (const payment of payments) {
      const current = map.get(payment.registration_id) ?? []
      current.push(payment)
      map.set(payment.registration_id, current)
    }
    return map
  }, [payments])

  const registrationViews = useMemo<RegistrationView[]>(() => {
    return registrations
      .map((registration) => {
        const participant = participantMap.get(registration.participant_id) ?? null
        const category = registration.category_id
          ? categoryMap.get(registration.category_id) ?? null
          : null

        const paymentList = paymentsByRegistration.get(registration.id) ?? []
        const latestPayment =
          [...paymentList].sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
            return bTime - aTime
          })[0] ?? null

        return {
          registration,
          participant,
          category,
          payment: latestPayment,
          amount: getRegistrationAmount(registration, tournament, category),
          playersCount: countPlayers(participant?.players ?? null),
        }
      })
      .sort((a, b) => {
        const aTime = a.registration.created_at ? new Date(a.registration.created_at).getTime() : 0
        const bTime = b.registration.created_at ? new Date(b.registration.created_at).getTime() : 0
        return bTime - aTime
      })
  }, [registrations, participantMap, categoryMap, paymentsByRegistration, tournament])

  const activeRegistrations = registrationViews.filter((view) =>
    isActiveRegistration(view.registration.status)
  )
  const confirmedRegistrations = activeRegistrations.filter((view) =>
    isConfirmedRegistration(view.registration.status)
  )
  const pendingCashValidations = activeRegistrations.filter(
    (view) =>
      view.registration.status === "pending_cash_validation" ||
      view.registration.status === "pending"
  )
  const pendingOnlinePayments = activeRegistrations.filter((view) => needsOnlineValidation(view))
  const cancelledRegistrations = registrationViews.filter(
    (view) => view.registration.status === "cancelled"
  )

  const revenue = registrationViews.reduce((acc, view) => {
    if (view.payment?.status === "paid") {
      return acc + Number(view.payment.amount ?? 0)
    }
    return acc
  }, 0)

  const totalCapacity = getCapacityForTournament(tournament, categories)
  const remainingSpots =
    totalCapacity === null ? null : Math.max(totalCapacity - activeRegistrations.length, 0)

  const groupedViews = useMemo(() => {
    if (!tournament.has_categories) {
      return [
        {
          id: "general",
          name: "Inscripciones del torneo",
          capacity: tournament.max_participants,
          views: registrationViews,
        },
      ]
    }

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      capacity: category.max_participants,
      views: registrationViews.filter((view) => view.registration.category_id === category.id),
    }))
  }, [tournament, categories, registrationViews])

  const copyPublicLink = async () => {
    try {
      const origin = window.location.origin
      await navigator.clipboard.writeText(`${origin}/torneos/${tournament.id}`)
      setCopyOk(true)
      window.setTimeout(() => setCopyOk(false), 1800)
    } catch {
      setCopyOk(false)
    }
  }

  const refresh = () => {
    router.refresh()
  }

  const updateTournamentStatus = async (nextStatus: TournamentStatus) => {
    setPageError(null)

    if (nextStatus === "published" && !canReopenTournament(tournament)) {
      setPageError("No puedes reabrir inscripciones si la fecha límite ya ha pasado.")
      return
    }

    setBusy(`status:${nextStatus}`)

    const { error } = await supabase.rpc("set_tournament_management_status", {
      p_tournament_id: tournament.id,
      p_next_status: nextStatus,
    })

    setBusy(null)

    if (error) {
      setPageError(mapManagementError(error.message))
      return
    }

    refresh()
  }

  const saveConfig = async () => {
    setPageError(null)

    if (!form.title.trim()) {
      setPageError("El título es obligatorio.")
      return
    }

    setBusy("save-config")

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      rules: form.rules.trim() || null,
      province: form.province.trim() || null,
      address: form.address.trim() || null,
      date: form.date || null,
      registration_deadline: form.registration_deadline || null,
      is_public: form.is_public,
    }

    const { error } = await supabase.from("tournaments").update(payload).eq("id", tournament.id)

    setBusy(null)

    if (error) {
      setPageError(error.message)
      return
    }

    refresh()
  }

  const confirmCashRegistration = async (view: RegistrationView) => {
    setPageError(null)

    if (!needsCashValidation(view)) {
      setPageError(
        "Solo puedes validar desde aquí inscripciones en efectivo pendientes de revisión."
      )
      return
    }

    setBusy(`paid:${view.registration.id}`)

    const { error } = await supabase.rpc("mark_cash_registration_paid", {
      p_registration_id: view.registration.id,
    })

    setBusy(null)

    if (error) {
      setPageError(mapManagementError(error.message))
      return
    }

    refresh()
  }

  const confirmOnlineRegistration = async (view: RegistrationView) => {
    setPageError(null)

    if (!needsOnlineValidation(view)) {
      setPageError(
        "Solo puedes confirmar desde aquí inscripciones online que sigan pendientes."
      )
      return
    }

    setBusy(`online:${view.registration.id}`)

    const { error } = await supabase.rpc("mark_online_registration_paid", {
      p_registration_id: view.registration.id,
    })

    setBusy(null)

    if (error) {
      setPageError(mapManagementError(error.message))
      return
    }

    refresh()
  }

  const cancelRegistration = async (view: RegistrationView) => {
    setPageError(null)

    if (!canCancelFromDashboard(view.registration.status)) {
      setPageError("Solo puedes cancelar inscripciones todavía pendientes desde este panel.")
      return
    }

    setBusy(`cancel:${view.registration.id}`)

    const { error } = await supabase.rpc("cancel_pending_registration_by_organizer", {
      p_registration_id: view.registration.id,
    })

    setBusy(null)

    if (error) {
      setPageError(mapManagementError(error.message))
      return
    }

    refresh()
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              Panel del torneo
            </h1>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(
                tournament.status
              )}`}
            >
              {getStatusLabel(tournament.status)}
            </span>
          </div>

          <p className="mt-3 text-lg text-gray-600">{tournament.title}</p>

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-500">
            <span>{formatDate(tournament.date)}</span>
            <span>·</span>
            <span>{tournament.province ?? "Provincia por definir"}</span>
            <span>·</span>
            <Link href={`/torneos/${tournament.id}`} className="font-medium text-indigo-600">
              Ver página pública
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={copyPublicLink}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            {copyOk ? "Enlace copiado" : "Copiar enlace público"}
          </button>
        </div>
      </div>

      {pageError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {pageError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Inscripciones activas"
          value={String(activeRegistrations.length)}
          iconClassName="bg-indigo-100 text-indigo-700"
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
              <circle cx="10" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
        <StatCard
          title="Confirmadas"
          value={String(confirmedRegistrations.length)}
          iconClassName="bg-green-100 text-green-700"
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-2">
              <path d="m20 6-11 11-5-5" />
            </svg>
          }
        />
        <StatCard
          title="Pendientes efectivo"
          value={String(pendingCashValidations.length)}
          iconClassName="bg-amber-100 text-amber-700"
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          }
        />
        <StatCard
          title="Pendientes online"
          value={String(pendingOnlinePayments.length)}
          iconClassName="bg-blue-100 text-blue-700"
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
          }
        />
        <StatCard
          title="Ingresos cobrados"
          value={formatMoney(revenue)}
          iconClassName="bg-emerald-100 text-emerald-700"
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-2">
              <path d="M12 1v22" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
      </div>

      <div className="flex flex-wrap gap-3 border-b border-gray-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("participants")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === "participants"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Inscripciones
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("config")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === "config"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Configuración
        </button>
      </div>

      {activeTab === "participants" ? (
        <SectionCard
          title="Inscripciones y operaciones"
          description="Aquí se ve el estado real de cada inscripción: confirmada, pendiente de validación en efectivo, pendiente online, cancelada o caducada."
          action={
            <div className="flex flex-wrap gap-3">
              {tournament.status === "published" && (
                <button
                  type="button"
                  onClick={() => updateTournamentStatus("closed")}
                  disabled={busy === "status:closed"}
                  className="rounded-xl border border-amber-200 px-4 py-3 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy === "status:closed" ? "Cerrando..." : "Cerrar inscripciones"}
                </button>
              )}

              {tournament.status === "closed" && (
                <button
                  type="button"
                  onClick={() => updateTournamentStatus("published")}
                  disabled={busy === "status:published" || !canReopenTournament(tournament)}
                  className="rounded-xl border border-green-200 px-4 py-3 text-sm font-medium text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy === "status:published" ? "Reabriendo..." : "Reabrir inscripciones"}
                </button>
              )}

              {(tournament.status === "published" || tournament.status === "closed") && (
                <button
                  type="button"
                  onClick={() => updateTournamentStatus("finished")}
                  disabled={busy === "status:finished"}
                  className="rounded-xl border border-blue-200 px-4 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy === "status:finished" ? "Finalizando..." : "Marcar como finalizado"}
                </button>
              )}

              {(tournament.status === "published" || tournament.status === "closed") && (
                <button
                  type="button"
                  onClick={() => updateTournamentStatus("cancelled")}
                  disabled={busy === "status:cancelled"}
                  className="rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy === "status:cancelled" ? "Cancelando..." : "Cancelar torneo"}
                </button>
              )}
            </div>
          }
        >
          {pendingOnlinePayments.length > 0 && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              Tienes inscripciones en <strong>pendiente de pago online</strong>. Mientras el
              pago online siga simulado, puedes confirmarlas manualmente desde este panel.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <p className="font-medium text-gray-900">Capacidad total</p>
              <p className="mt-2">
                {totalCapacity === null ? "Sin máximo" : `${totalCapacity} plazas`}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <p className="font-medium text-gray-900">Plazas restantes</p>
              <p className="mt-2">
                {remainingSpots === null ? "Sin máximo" : `${remainingSpots} libres`}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <p className="font-medium text-gray-900">Canceladas</p>
              <p className="mt-2">{cancelledRegistrations.length}</p>
            </div>
          </div>

          <div className="space-y-6">
            {groupedViews.map((group) => {
              const activeGroupCount = group.views.filter((view) =>
                isActiveRegistration(view.registration.status)
              ).length

              const remainingGroupSpots =
                group.capacity === null ? null : Math.max(group.capacity - activeGroupCount, 0)

              return (
                <div key={group.id} className="overflow-hidden rounded-2xl border border-gray-200">
                  <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {group.capacity === null
                          ? `${activeGroupCount} activas · sin máximo`
                          : `${activeGroupCount}/${group.capacity} activas · ${remainingGroupSpots} plazas restantes`}
                      </p>
                    </div>

                    {tournament.has_categories && group.views.length > 0 && (
                      <div className="text-sm text-gray-500">
                        Precio: {formatMoney(group.views[0]?.category?.price ?? 0)}
                      </div>
                    )}
                  </div>

                  {group.views.length === 0 ? (
                    <div className="px-5 py-8 text-sm text-gray-500">
                      Todavía no hay inscripciones en este bloque.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-white text-left text-gray-500">
                          <tr className="border-b border-gray-200">
                            <th className="px-5 py-3 font-medium">Participante</th>
                            <th className="px-5 py-3 font-medium">Contacto</th>
                            <th className="px-5 py-3 font-medium">Estado</th>
                            <th className="px-5 py-3 font-medium">Pago</th>
                            <th className="px-5 py-3 font-medium">Referencia</th>
                            <th className="px-5 py-3 font-medium">Alta</th>
                            <th className="px-5 py-3 font-medium text-right">Acciones</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100 bg-white">
                          {group.views.map((view) => (
                            <tr key={view.registration.id}>
                              <td className="px-5 py-4 align-top">
                                <div className="font-medium text-gray-900">
                                  {view.participant?.display_name ?? "Participante eliminado"}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  {view.participant?.type === "team"
                                    ? `Equipo${view.playersCount ? ` · ${view.playersCount} jugadores` : ""}`
                                    : "Individual"}
                                </div>
                                {view.category && (
                                  <div className="mt-1 text-xs text-gray-500">
                                    Categoría: {view.category.name}
                                  </div>
                                )}
                              </td>

                              <td className="px-5 py-4 align-top text-gray-600">
                                <div>{view.participant?.contact_email ?? "Sin email"}</div>
                                <div className="mt-1">
                                  {view.participant?.contact_phone ?? "Sin teléfono"}
                                </div>
                              </td>

                              <td className="px-5 py-4 align-top">
                                <div
                                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRegistrationStatusBadge(
                                    view
                                  )}`}
                                >
                                  {getRegistrationStatusLabel(view)}
                                </div>
                                {view.registration.cancelled_at && (
                                  <div className="mt-2 text-xs text-gray-500">
                                    Cancelada: {formatDateTime(view.registration.cancelled_at)}
                                  </div>
                                )}
                              </td>

                              <td className="px-5 py-4 align-top text-gray-600">
                                <div>{getPaymentMethodLabel(view.registration.payment_method)}</div>
                                <div className="mt-1 text-xs text-gray-500">
                                  {formatMoney(view.amount)} · {getPaymentStatusLabel(view)}
                                </div>
                                {view.payment?.paid_at && (
                                  <div className="mt-1 text-xs text-gray-500">
                                    Cobrado: {formatDateTime(view.payment.paid_at)}
                                  </div>
                                )}
                              </td>

                              <td className="px-5 py-4 align-top text-gray-600">
                                {view.registration.public_reference ?? "—"}
                              </td>

                              <td className="px-5 py-4 align-top text-gray-600">
                                {formatDateTime(view.registration.created_at)}
                              </td>

                              <td className="px-5 py-4 align-top">
                                <div className="flex flex-col items-end gap-2">
                                  {needsCashValidation(view) && (
                                    <button
                                      type="button"
                                      onClick={() => confirmCashRegistration(view)}
                                      disabled={busy === `paid:${view.registration.id}`}
                                      className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {busy === `paid:${view.registration.id}`
                                        ? "Guardando..."
                                        : "Validar pago en efectivo"}
                                    </button>
                                  )}

                                  {needsOnlineValidation(view) && (
                                    <button
                                      type="button"
                                      onClick={() => confirmOnlineRegistration(view)}
                                      disabled={busy === `online:${view.registration.id}`}
                                      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {busy === `online:${view.registration.id}`
                                        ? "Guardando..."
                                        : "Confirmar pago online (simulado)"}
                                    </button>
                                  )}

                                  {canCancelFromDashboard(view.registration.status) && (
                                    <button
                                      type="button"
                                      onClick={() => cancelRegistration(view)}
                                      disabled={busy === `cancel:${view.registration.id}`}
                                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {busy === `cancel:${view.registration.id}`
                                        ? "Cancelando..."
                                        : "Cancelar inscripción"}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </SectionCard>
      ) : (
        <SectionCard
          title="Configuración"
          description="Edita la información pública del torneo y su visibilidad."
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <div>
                <label className="label">Título del torneo</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="label">Provincia</label>
                  <input
                    className="input"
                    value={form.province}
                    onChange={(e) => setForm((prev) => ({ ...prev, province: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label">Dirección</label>
                  <input
                    className="input"
                    value={form.address}
                    onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="label">Fecha del torneo</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.date}
                    onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label">Fecha límite de inscripción</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.registration_deadline}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        registration_deadline: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="label">Descripción</label>
                <textarea
                  className="textarea min-h-32"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Añade una descripción clara del torneo"
                />
              </div>

              <div>
                <label className="label">Reglas / normativa</label>
                <textarea
                  className="textarea min-h-40"
                  value={form.rules}
                  onChange={(e) => setForm((prev) => ({ ...prev, rules: e.target.value }))}
                  placeholder="Normativa, formato, condiciones y requisitos"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div>
                  <p className="font-medium text-gray-900">Visibilidad pública</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Si lo desactivas, el torneo no se listará en explorar y solo será accesible
                    por enlace directo.
                  </p>
                </div>

                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.is_public}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_public: e.target.checked }))}
                  />
                  <span className="slider" />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={saveConfig}
                  disabled={busy === "save-config"}
                  className="btn-primary"
                >
                  {busy === "save-config" ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">Resumen operativo</h3>
                <div className="mt-4 space-y-3 text-sm text-gray-600">
                  <p>
                    <span className="font-medium text-gray-900">Estado:</span>{" "}
                    {getStatusLabel(tournament.status)}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Estructura:</span>{" "}
                    {tournament.has_categories ? "Con categorías" : "Sin categorías"}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Cupos:</span>{" "}
                    {totalCapacity === null ? "Sin máximo" : `${totalCapacity} plazas`}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Precio base:</span>{" "}
                    {tournament.has_categories
                      ? "Por categoría"
                      : formatMoney(tournament.entry_price)}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Activas:</span>{" "}
                    {activeRegistrations.length}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Pendientes efectivo:</span>{" "}
                    {pendingCashValidations.length}
                  </p>
                  <p>
                    <span className="font-medium text-gray-900">Pendientes online:</span>{" "}
                    {pendingOnlinePayments.length}
                  </p>
                  {pendingOnlinePayments.length > 0 && (
                    <p className="rounded-xl bg-blue-50 p-3 text-blue-900">
                      Mientras el pago online siga simulado, estas inscripciones se confirman
                      manualmente desde el panel.
                    </p>
                  )}
                </div>
              </div>

              {categories.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900">Categorías</h3>
                  <div className="mt-4 space-y-3">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm"
                      >
                        <p className="font-medium text-gray-900">{category.name}</p>
                        <p className="mt-1 text-gray-600">
                          {formatMoney(category.price)} ·{" "}
                          {category.max_participants === null
                            ? "sin máximo"
                            : `máx. ${category.max_participants}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}