import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import CopyTournamentLinkButton from "@/components/copy-tournament-link-button"
import { runAutomaticStateSync } from "@/lib/tournaments/server"
import type { Enums, Tables } from "@/types/database"

type TournamentStatus = Enums<"tournament_status">
type RegistrationStatus = Enums<"registration_status">

type TournamentRow = Pick<
  Tables<"tournaments">,
  | "id"
  | "title"
  | "date"
  | "registration_deadline"
  | "max_participants"
  | "min_participants"
  | "has_categories"
  | "entry_price"
  | "is_public"
  | "status"
  | "created_at"
  | "updated_at"
>

type CategoryRow = Pick<
  Tables<"categories">,
  "id" | "tournament_id" | "name" | "price" | "min_participants" | "max_participants"
>

type RegistrationRow = Pick<
  Tables<"registrations">,
  "id" | "tournament_id" | "category_id" | "status" | "payment_method"
>

type PaymentRow = Pick<Tables<"payments">, "id" | "registration_id" | "amount" | "status">

type TournamentMetrics = {
  registrationsCount: number
  confirmedCount: number
  pendingCashCount: number
  pendingOnlineCount: number
  revenue: number
  capacity: number | null
  occupancyPercent: number | null
}

type TournamentView = TournamentRow & TournamentMetrics

function formatDate(value: string | null) {
  if (!value) return "Fecha por definir"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Fecha por definir"

  return date.toLocaleDateString("es-ES")
}

function formatMoney(value: number | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return "—"
  if (amount === 0) return "Gratis"

  const text = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2).replace(/\.00$/, "")

  return `${text}€`
}

function getTournamentStatusBadge(status: TournamentStatus | null) {
  if (status === "draft") {
    return "bg-gray-100 text-gray-700 border border-gray-200"
  }
  if (status === "published") {
    return "bg-green-100 text-green-700 border border-green-200"
  }
  if (status === "closed") {
    return "bg-amber-100 text-amber-700 border border-amber-200"
  }
  if (status === "finished") {
    return "bg-blue-100 text-blue-700 border border-blue-200"
  }

  return "bg-red-100 text-red-700 border border-red-200"
}

function getTournamentStatusLabel(status: TournamentStatus | null) {
  if (status === "draft") return "Borrador legacy"
  if (status === "published") return "Publicado"
  if (status === "closed") return "Cerrado"
  if (status === "finished") return "Finalizado"
  return "Cancelado"
}

function getRegistrationBadge(
  tournament: Pick<TournamentRow, "status" | "registration_deadline">
) {
  if (tournament.status === "closed") {
    return {
      label: "Inscripciones cerradas",
      className: "bg-amber-50 text-amber-700 border border-amber-200",
    }
  }

  if (tournament.status !== "published") {
    return null
  }

  const deadline = tournament.registration_deadline
    ? new Date(tournament.registration_deadline)
    : null

  if (deadline && !Number.isNaN(deadline.getTime()) && deadline < new Date()) {
    return {
      label: "Inscripciones cerradas",
      className: "bg-amber-50 text-amber-700 border border-amber-200",
    }
  }

  return {
    label: "Inscripciones abiertas",
    className: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  }
}

function getCapacityFromTournament(
  tournament: TournamentRow,
  categories: CategoryRow[]
): number | null {
  if (!tournament.has_categories) {
    return tournament.max_participants
  }

  if (categories.length === 0) return null
  if (categories.some((category) => category.max_participants === null)) return null

  return categories.reduce((acc, category) => acc + (category.max_participants ?? 0), 0)
}

function getParticipantLine(view: TournamentView) {
  if (view.capacity === null) {
    return `${view.registrationsCount} activas · Sin máximo`
  }

  return `${view.registrationsCount}/${view.capacity} activas`
}

function sortByDateAsc(a: TournamentView, b: TournamentView) {
  const aTime = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER
  const bTime = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER
  return aTime - bTime
}

function sortByDateDesc(a: TournamentView, b: TournamentView) {
  const aTime = a.date ? new Date(a.date).getTime() : 0
  const bTime = b.date ? new Date(b.date).getTime() : 0
  return bTime - aTime
}

function sortByUpdatedDesc(a: TournamentView, b: TournamentView) {
  const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
  const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
  return bTime - aTime
}

function isCancelledLike(status: RegistrationStatus | null) {
  return status === "cancelled" || status === "expired"
}

function isConfirmedLike(status: RegistrationStatus | null) {
  return status === "confirmed" || status === "paid"
}

function isPendingCashLike(registration: RegistrationRow) {
  return (
    registration.payment_method === "cash" &&
    (registration.status === "pending_cash_validation" || registration.status === "pending")
  )
}

function isPendingOnlineLike(registration: RegistrationRow) {
  return (
    registration.payment_method === "online" &&
    registration.status === "pending_online_payment"
  )
}

function StatCard({
  title,
  value,
  icon,
  iconClassName,
}: {
  title: string
  value: string
  icon: React.ReactNode
  iconClassName: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconClassName}`}
        >
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

function EmptySection({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  )
}

function TournamentCard({
  tournament,
}: {
  tournament: TournamentView
}) {
  const statusBadge = getTournamentStatusBadge(tournament.status)
  const statusLabel = getTournamentStatusLabel(tournament.status)
  const registrationBadge = getRegistrationBadge(tournament)
  const isLegacyDraft = tournament.status === "draft"

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadge}`}
        >
          {statusLabel}
        </span>
        {registrationBadge && !isLegacyDraft && (
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${registrationBadge.className}`}
          >
            {registrationBadge.label}
          </span>
        )}
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight text-gray-900">
            {tournament.title}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {isLegacyDraft
              ? "Resto del flujo anterior. No conviene seguirlo ni reabrir rutas viejas."
              : tournament.is_public
                ? "Torneo público"
                : "Oculto del explorador, accesible por enlace"}
          </p>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span>📅</span>
            <span>{formatDate(tournament.date)}</span>
          </div>

          {!isLegacyDraft && (
            <div className="flex items-center gap-2">
              <span>⏳</span>
              <span>Límite inscripción: {formatDate(tournament.registration_deadline)}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span>👥</span>
            <span>{getParticipantLine(tournament)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{tournament.confirmedCount} confirmadas</span>
          </div>

          <div className="flex items-center gap-2">
            <span>💶</span>
            <span>{formatMoney(tournament.revenue)} recaudado</span>
          </div>

          {(tournament.pendingCashCount > 0 || tournament.pendingOnlineCount > 0) && (
            <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
              {tournament.pendingCashCount > 0 && (
                <p>{tournament.pendingCashCount} pendientes de validación en efectivo</p>
              )}
              {tournament.pendingOnlineCount > 0 && (
                <p>{tournament.pendingOnlineCount} pendientes de pago online</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Ocupación</span>
            <span>
              {tournament.occupancyPercent === null
                ? "Sin máximo"
                : `${tournament.occupancyPercent}%`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{
                width:
                  tournament.occupancyPercent === null
                    ? "35%"
                    : `${Math.min(tournament.occupancyPercent, 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
          {isLegacyDraft ? (
            <>
              <Link href="/crear-torneo" className="btn-primary w-full text-center sm:w-auto">
                Crear de nuevo
              </Link>
              <p className="text-xs text-gray-500">
                El flujo actual ya no guarda drafts en base de datos.
              </p>
            </>
          ) : (
            <>
              <Link
                href={`/torneo/${tournament.id}/gestionar`}
                className="btn-primary w-full text-center sm:w-auto"
              >
                Gestionar
              </Link>
              <Link
                href={`/torneos/${tournament.id}`}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Ver pública
              </Link>
              <CopyTournamentLinkButton path={`/torneos/${tournament.id}`} />
            </>
          )}
        </div>
      </div>
    </article>
  )
}

export default async function MisTorneosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  await runAutomaticStateSync(supabase)

  const { data: tournamentsData, error: tournamentsError } = await supabase
    .from("tournaments")
    .select(`
      id,
      title,
      date,
      registration_deadline,
      max_participants,
      min_participants,
      has_categories,
      entry_price,
      is_public,
      status,
      created_at,
      updated_at
    `)
    .eq("organizer_id", user.id)
    .returns<TournamentRow[]>()

  if (tournamentsError) {
    throw new Error(tournamentsError.message)
  }

  const tournaments = tournamentsData ?? []
  const tournamentIds = tournaments.map((tournament) => tournament.id)

  let categories: CategoryRow[] = []
  let registrations: RegistrationRow[] = []
  let payments: PaymentRow[] = []

  if (tournamentIds.length > 0) {
    const { data: categoriesData, error: categoriesError } = await supabase
      .from("categories")
      .select("id,tournament_id,name,price,min_participants,max_participants")
      .in("tournament_id", tournamentIds)
      .returns<CategoryRow[]>()

    if (categoriesError) {
      throw new Error(categoriesError.message)
    }

    categories = categoriesData ?? []

    const { data: registrationsData, error: registrationsError } = await supabase
      .from("registrations")
      .select("id,tournament_id,category_id,status,payment_method")
      .in("tournament_id", tournamentIds)
      .returns<RegistrationRow[]>()

    if (registrationsError) {
      throw new Error(registrationsError.message)
    }

    registrations = registrationsData ?? []

    const registrationIds = registrations.map((registration) => registration.id)

    if (registrationIds.length > 0) {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("id,registration_id,amount,status")
        .in("registration_id", registrationIds)
        .returns<PaymentRow[]>()

      if (paymentsError) {
        throw new Error(paymentsError.message)
      }

      payments = paymentsData ?? []
    }
  }

  const tournamentMap = new Map(tournaments.map((tournament) => [tournament.id, tournament]))
  const categoryMap = new Map(categories.map((category) => [category.id, category]))

  const categoriesByTournament = new Map<string, CategoryRow[]>()
  for (const category of categories) {
    const current = categoriesByTournament.get(category.tournament_id) ?? []
    current.push(category)
    categoriesByTournament.set(category.tournament_id, current)
  }

  const paymentsByRegistration = new Map<string, PaymentRow[]>()
  for (const payment of payments) {
    const current = paymentsByRegistration.get(payment.registration_id) ?? []
    current.push(payment)
    paymentsByRegistration.set(payment.registration_id, current)
  }

  const metricsMap = new Map<string, TournamentMetrics>()
  for (const tournament of tournaments) {
    const tournamentCategories = categoriesByTournament.get(tournament.id) ?? []
    const capacity = getCapacityFromTournament(tournament, tournamentCategories)

    metricsMap.set(tournament.id, {
      registrationsCount: 0,
      confirmedCount: 0,
      pendingCashCount: 0,
      pendingOnlineCount: 0,
      revenue: 0,
      capacity,
      occupancyPercent: null,
    })
  }

  for (const registration of registrations) {
    const category = registration.category_id ? categoryMap.get(registration.category_id) : null
    const tournamentId = registration.tournament_id ?? category?.tournament_id ?? null

    if (!tournamentId) continue

    const tournament = tournamentMap.get(tournamentId)
    const metrics = metricsMap.get(tournamentId)

    if (!tournament || !metrics) continue

    if (!isCancelledLike(registration.status)) {
      metrics.registrationsCount += 1
    }

    if (isConfirmedLike(registration.status)) {
      metrics.confirmedCount += 1
    }

    if (isPendingCashLike(registration)) {
      metrics.pendingCashCount += 1
    }

    if (isPendingOnlineLike(registration)) {
      metrics.pendingOnlineCount += 1
    }

    const paymentList = paymentsByRegistration.get(registration.id) ?? []
    for (const payment of paymentList) {
      if (payment.status === "paid") {
        const amount = Number(payment.amount ?? 0)
        if (Number.isFinite(amount)) {
          metrics.revenue += amount
        }
      }
    }
  }

  const allTournaments: TournamentView[] = tournaments.map((tournament) => {
    const metrics = metricsMap.get(tournament.id)

    if (!metrics) {
      return {
        ...tournament,
        registrationsCount: 0,
        confirmedCount: 0,
        pendingCashCount: 0,
        pendingOnlineCount: 0,
        revenue: 0,
        capacity: null,
        occupancyPercent: null,
      }
    }

    const occupancyPercent =
      metrics.capacity && metrics.capacity > 0
        ? Math.round((metrics.registrationsCount / metrics.capacity) * 100)
        : null

    return {
      ...tournament,
      ...metrics,
      occupancyPercent,
    }
  })

  const activeTournaments = allTournaments
    .filter((tournament) => tournament.status === "published" || tournament.status === "closed")
    .sort(sortByDateAsc)

  const legacyDrafts = allTournaments
    .filter((tournament) => tournament.status === "draft")
    .sort(sortByUpdatedDesc)

  const finishedTournaments = allTournaments
    .filter((tournament) => tournament.status === "finished")
    .sort(sortByDateDesc)

  const cancelledTournaments = allTournaments
    .filter((tournament) => tournament.status === "cancelled")
    .sort(sortByUpdatedDesc)

  const totalTournaments = allTournaments.length
  const totalActive = activeTournaments.length
  const totalConfirmed = allTournaments.reduce(
    (acc, tournament) => acc + tournament.confirmedCount,
    0
  )
  const totalRevenue = allTournaments.reduce((acc, tournament) => acc + tournament.revenue, 0)

  return (
    <div className="section-spacing">
      <div className="container-custom space-y-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">Mis torneos</h1>
            <p className="mt-3 max-w-3xl text-lg text-gray-600">
              Gestiona tus torneos activos, revisa estados reales de inscripción y controla la
              operación desde un solo sitio.
            </p>
          </div>

          <Link href="/crear-torneo" className="btn-primary">
            + Crear nuevo torneo
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total torneos"
            value={String(totalTournaments)}
            iconClassName="bg-blue-50 text-blue-600"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M4 19V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M10 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M16 19V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M22 19V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
          />

          <StatCard
            title="Activos"
            value={String(totalActive)}
            iconClassName="bg-green-50 text-green-600"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="16"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path d="M8 3V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M16 3V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M3 11H21" stroke="currentColor" strokeWidth="2" />
              </svg>
            }
          />

          <StatCard
            title="Confirmadas"
            value={String(totalConfirmed)}
            iconClassName="bg-indigo-50 text-indigo-600"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 6L9 17L4 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />

          <StatCard
            title="Recaudación"
            value={formatMoney(totalRevenue)}
            iconClassName="bg-purple-50 text-purple-600"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 3V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path
                  d="M17 7.5C17 5.567 14.7614 4 12 4C9.23858 4 7 5.567 7 7.5C7 9.433 9.23858 11 12 11C14.7614 11 17 12.567 17 14.5C17 16.433 14.7614 18 12 18C9.23858 18 7 16.433 7 14.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
        </div>

        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
              Torneos activos
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Publicados o cerrados, pero todavía en operación real.
            </p>
          </div>

          {activeTournaments.length === 0 ? (
            <EmptySection
              title="No tienes torneos activos"
              description="Cuando publiques un torneo o cierres inscripciones de uno ya existente, aparecerá aquí."
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {activeTournaments.map((tournament) => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))}
            </div>
          )}
        </section>

        {legacyDrafts.length > 0 && (
          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                Borradores legacy
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Son restos del flujo antiguo. El flujo actual ya no crea borradores en base de
                datos.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              No continúes estos borradores desde rutas antiguas. Si quieres seguir, recréalos con
              el flujo nuevo.
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {legacyDrafts.map((tournament) => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
              Torneos finalizados
            </h2>
            <p className="mt-1 text-sm text-gray-500">Historial de torneos ya terminados.</p>
          </div>

          {finishedTournaments.length === 0 ? (
            <EmptySection
              title="No tienes torneos finalizados"
              description="Cuando marques un torneo como finalizado, lo verás aquí."
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {finishedTournaments.map((tournament) => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))}
            </div>
          )}
        </section>

        {cancelledTournaments.length > 0 && (
          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                Torneos cancelados
              </h2>
              <p className="mt-1 text-sm text-gray-500">Torneos que ya no seguirán adelante.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {cancelledTournaments.map((tournament) => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}