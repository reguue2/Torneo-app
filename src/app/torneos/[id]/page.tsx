import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import ShareButton from "./share-button"
import {
  formatDate,
  formatMoney,
  getPublicVisibilityLabel,
  getRegistrationState,
  getSidebarStatus,
  paymentMethodLabel,
} from "@/lib/tournaments/domain"

type Category = {
  id: string
  name: string
  price: number
  min_participants: number
  max_participants: number | null
  start_at: string | null
  address: string | null
  prizes: string | null
}

type Tournament = {
  id: string
  title: string
  description: string | null
  poster_url: string | null
  prizes: string | null
  rules: string | null
  province: string | null
  address: string | null
  date: string | null
  max_participants: number | null
  min_participants: number
  registration_deadline: string | null
  payment_method: "cash" | "online" | "both" | null
  is_public: boolean | null
  status: "draft" | "published" | "closed" | "finished" | "cancelled" | null
  has_categories: boolean
  prize_mode: "none" | "global" | "per_category"
  entry_price: number
}

const VISIBLE_PUBLIC_STATUSES: Array<
  "published" | "closed" | "finished" | "cancelled"
> = ["published", "closed", "finished", "cancelled"]

function getPriceSummary(tournament: Tournament, categories: Category[]) {
  if (!tournament.has_categories) {
    return formatMoney(tournament.entry_price)
  }

  const prices = categories
    .map((category) => Number(category.price))
    .filter((price) => Number.isFinite(price))

  if (prices.length === 0) return "Según categoría"

  return `Desde ${formatMoney(Math.min(...prices))}`
}

function getCapacitySummary(tournament: Tournament, categories: Category[]) {
  if (!tournament.has_categories) {
    return tournament.max_participants === null
      ? `Mínimo ${tournament.min_participants} · Sin máximo`
      : `${tournament.max_participants} plazas máx.`
  }

  if (categories.length === 0) return "Cupos por categoría"

  const totalMax = categories.reduce((acc, category) => {
    if (category.max_participants === null) return acc
    return acc + category.max_participants
  }, 0)

  const hasUnlimited = categories.some(
    (category) => category.max_participants === null
  )

  if (hasUnlimited) return "Cupos por categoría"

  return `${totalMax} plazas máx.`
}

function getCategoriesSummary(categories: Category[]) {
  if (categories.length === 0) return "No definidas"
  if (categories.length === 1) return categories[0].name
  return `${categories.length} categorías disponibles`
}

export default async function TorneoPublicoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()

  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select(`
      id,
      title,
      description,
      poster_url,
      prizes,
      rules,
      province,
      address,
      date,
      max_participants,
      min_participants,
      registration_deadline,
      payment_method,
      is_public,
      status,
      has_categories,
      prize_mode,
      entry_price
    `)
    .eq("id", id)
    .in("status", VISIBLE_PUBLIC_STATUSES)
    .single()

  if (error || !tournament) {
    notFound()
  }

  let categories: Category[] = []

  if (tournament.has_categories) {
    const { data } = await supabase
      .from("categories")
      .select("id,name,price,min_participants,max_participants,start_at,address,prizes")
      .eq("tournament_id", id)
      .order("name", { ascending: true })

    categories = (data as Category[]) ?? []
  }

  const tournamentData = tournament as Tournament
  const status = getSidebarStatus(tournamentData)
  const registrationState = getRegistrationState(tournamentData)
  const sharePath = `/torneos/${tournamentData.id}`
  const registerPath = `/torneo/${tournamentData.id}/inscribirse`

  return (
    <div className="section-spacing">
      <div className="container-custom space-y-8">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Link href="/explorar" className="transition-colors hover:text-gray-900">
            Explorar torneos
          </Link>
          <span>/</span>
          <span className="truncate">{tournamentData.title}</span>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="relative aspect-[16/6] min-h-[240px] w-full bg-gray-100">
            {tournamentData.poster_url ? (
              <Image
                src={tournamentData.poster_url}
                alt={tournamentData.title}
                fill
                className="object-cover"
                sizes="100vw"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                Sin cartel
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.badge}`}
                  >
                    {status.label}
                  </span>

                  <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-gray-900">
                    {tournamentData.title}
                  </h1>

                  <p className="text-base text-gray-600">
                    {tournamentData.province ?? "Ubicación por definir"}
                    {tournamentData.address ? ` · ${tournamentData.address}` : ""}
                  </p>
                </div>

                <ShareButton path={sharePath} variant="icon" />
              </div>

              {tournamentData.description && (
                <p className="max-w-3xl whitespace-pre-wrap text-gray-600">
                  {tournamentData.description}
                </p>
              )}
            </div>

            <section className="card divide-y divide-gray-100 p-0">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Detalles del torneo
                </h2>
              </div>

              <div className="grid gap-6 p-6">
                <div className="grid gap-2">
                  <p className="text-sm font-medium text-gray-900">Ubicación</p>
                  <p className="text-gray-600">
                    {tournamentData.province ?? "Por definir"}
                    {tournamentData.address ? ` · ${tournamentData.address}` : ""}
                  </p>
                </div>

                <div className="grid gap-2">
                  <p className="text-sm font-medium text-gray-900">Fecha</p>
                  <p className="text-gray-600">{formatDate(tournamentData.date, true)}</p>
                  <p className="text-sm text-gray-500">
                    Fecha límite de inscripción:{" "}
                    {formatDate(tournamentData.registration_deadline)}
                  </p>
                </div>

                <div className="grid gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    Cuota de inscripción
                  </p>
                  <p className="text-gray-600">
                    {getPriceSummary(tournamentData, categories)}
                  </p>
                  <p className="text-sm text-gray-500">
                    Método de pago: {paymentMethodLabel(tournamentData.payment_method)}
                  </p>
                </div>

                <div className="grid gap-2">
                  <p className="text-sm font-medium text-gray-900">Cupos</p>
                  <p className="text-gray-600">
                    {getCapacitySummary(tournamentData, categories)}
                  </p>
                </div>

                {tournamentData.has_categories && (
                  <div className="grid gap-2">
                    <p className="text-sm font-medium text-gray-900">Categorías</p>
                    <p className="text-gray-600">{getCategoriesSummary(categories)}</p>
                  </div>
                )}

                {tournamentData.prize_mode !== "none" && (
                  <div className="grid gap-3">
                    <p className="text-sm font-medium text-gray-900">Premios</p>

                    {tournamentData.prize_mode === "global" && (
                      <p className="whitespace-pre-wrap text-gray-600">
                        {tournamentData.prizes ?? "—"}
                      </p>
                    )}

                    {tournamentData.prize_mode === "per_category" && (
                      <div className="grid gap-3">
                        {categories.map((category) => (
                          <div
                            key={category.id}
                            className="rounded-2xl border border-gray-200 p-4"
                          >
                            <p className="font-medium text-gray-900">
                              {category.name}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                              {category.prizes ?? "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {tournamentData.rules && (
              <section className="card space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Reglas y normativa
                </h2>
                <p className="whitespace-pre-wrap text-gray-600">
                  {tournamentData.rules}
                </p>
              </section>
            )}

            {tournamentData.has_categories && categories.length > 0 && (
              <section className="card space-y-5">
                <h2 className="text-lg font-semibold text-gray-900">
                  Categorías disponibles
                </h2>

                <div className="grid gap-4">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="rounded-2xl border border-gray-200 p-5"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {category.name}
                          </h3>

                          <div className="space-y-1 text-sm text-gray-600">
                            <p>Precio: {formatMoney(category.price)}</p>
                            <p>
                              Cupo:{" "}
                              {category.max_participants === null
                                ? `mín. ${category.min_participants} · sin máximo`
                                : `mín. ${category.min_participants} · máx. ${category.max_participants}`}
                            </p>
                            {category.start_at && (
                              <p>Fecha/hora: {formatDate(category.start_at)}</p>
                            )}
                            {category.address && <p>Dirección: {category.address}</p>}
                          </div>
                        </div>

                        {category.prizes && (
                          <div className="max-w-md rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                            <p className="mb-1 font-medium text-gray-900">Premios</p>
                            <p className="whitespace-pre-wrap">{category.prizes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <div className="card sticky top-24 space-y-5">
              <div className="space-y-2">
                <p className="text-sm text-gray-500">Estado</p>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.badge}`}
                >
                  {status.label}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-500">Plazas</p>
                <p className="text-2xl font-bold text-gray-900">
                  {getCapacitySummary(tournamentData, categories)}
                </p>
              </div>

              {registrationState.canJoin ? (
                <Link href={registerPath} className="btn-primary w-full text-center">
                  {registrationState.buttonLabel}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="btn-primary w-full cursor-not-allowed opacity-60"
                >
                  {registrationState.buttonLabel}
                </button>
              )}

              <ShareButton path={sharePath} variant="full" />

              <div className="space-y-2 border-t border-gray-100 pt-5">
                <p className="text-sm text-gray-500">Visibilidad</p>
                <p className="text-sm text-gray-700">
                  {getPublicVisibilityLabel(tournamentData.is_public)}
                </p>
              </div>

              <div className="space-y-2 border-t border-gray-100 pt-5">
                <p className="text-sm text-gray-500">Inscripción</p>
                <p className="text-sm text-gray-700">
                  {registrationState.message}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}