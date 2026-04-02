import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { SPAIN_COMMUNITIES, normalizeText } from "@/lib/spain"
import {
  formatDate,
  formatMoney,
  getExploreStatus,
  paymentMethodLabel,
} from "@/lib/tournaments/domain"
import { runAutomaticStateSync } from "@/lib/tournaments/server"
import type { Tables } from "@/types/database"

type ExploreSearchParams = Promise<{
  q?: string
  province?: string
}>

type ExploreCategory = Pick<
  Tables<"categories">,
  "id" | "name" | "price" | "min_participants" | "max_participants"
>

type ExploreTournament = Pick<
  Tables<"tournaments">,
  | "id"
  | "title"
  | "poster_url"
  | "province"
  | "date"
  | "registration_deadline"
  | "status"
  | "has_categories"
  | "min_participants"
  | "max_participants"
  | "entry_price"
  | "payment_method"
> & {
  categories: ExploreCategory[] | null
}

function getPriceLabel(tournament: ExploreTournament) {
  if (!tournament.has_categories) {
    return formatMoney(tournament.entry_price)
  }

  const prices = (tournament.categories ?? [])
    .map((category) => Number(category.price))
    .filter((price) => Number.isFinite(price))

  if (prices.length === 0) return "Por categoría"

  return `Desde ${formatMoney(Math.min(...prices))}`
}

function getCapacityLabel(tournament: ExploreTournament) {
  if (!tournament.has_categories) {
    return tournament.max_participants === null
      ? `Mín. ${tournament.min_participants} · Sin máximo`
      : `Mín. ${tournament.min_participants} · Máx. ${tournament.max_participants}`
  }

  const categories = tournament.categories ?? []
  if (categories.length === 0) return "Cupos por categoría"

  const hasUnlimitedCategory = categories.some(
    (category) => category.max_participants === null
  )

  if (hasUnlimitedCategory) {
    return `${categories.length} categorías · cupos por categoría`
  }

  const totalMax = categories.reduce(
    (acc, category) => acc + (category.max_participants ?? 0),
    0
  )

  return `${categories.length} categorías · ${totalMax} plazas máx.`
}

function getStructureLabel(tournament: ExploreTournament) {
  if (!tournament.has_categories) {
    return "Inscripción general"
  }

  const categories = tournament.categories ?? []
  if (categories.length === 0) return "Con categorías"
  if (categories.length === 1) return `1 categoría: ${categories[0].name}`

  return `${categories.length} categorías disponibles`
}

export default async function ExplorarPage({
  searchParams,
}: {
  searchParams: ExploreSearchParams
}) {
  const { q = "", province = "" } = await searchParams
  const supabase = await createClient()

  await runAutomaticStateSync(supabase)

  let query = supabase
    .from("tournaments")
    .select(`
      id,
      title,
      poster_url,
      province,
      date,
      registration_deadline,
      status,
      has_categories,
      min_participants,
      max_participants,
      entry_price,
      payment_method,
      categories (
        id,
        name,
        price,
        min_participants,
        max_participants
      )
    `)
    .eq("status", "published")
    .eq("is_public", true)
    .order("date", { ascending: true })

  if (province) {
    query = query.eq("province", province)
  }

  const { data, error } = await query.returns<ExploreTournament[]>()

  if (error) {
    throw new Error(error.message)
  }

  const normalizedQuery = normalizeText(q)

  const tournaments = (data ?? []).filter((tournament) => {
    if (!normalizedQuery) return true

    const haystack = [
      tournament.title,
      tournament.province ?? "",
      ...(tournament.categories ?? []).map((category) => category.name),
    ]
      .map((value) => normalizeText(value))
      .join(" ")

    return haystack.includes(normalizedQuery)
  })

  return (
    <div className="section-spacing">
      <div className="container-custom space-y-8">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Explorar torneos
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Solo se muestran torneos públicos y publicados. Desde aquí la gente entra a la página
            pública y, si procede, inicia la solicitud de inscripción.
          </p>
        </div>

        <form method="get" className="card p-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.8fr)_auto]">
            <div>
              <label htmlFor="q" className="sr-only">
                Buscar torneos
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Buscar por torneo, provincia o categoría"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="province" className="sr-only">
                Provincia
              </label>
              <select
                id="province"
                name="province"
                defaultValue={province}
                className="input"
              >
                <option value="">Todas las provincias</option>
                {SPAIN_COMMUNITIES.map((provinceOption) => (
                  <option key={provinceOption} value={provinceOption}>
                    {provinceOption}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn-primary">
              Filtrar
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          <p>
            {tournaments.length === 1
              ? "1 torneo encontrado"
              : `${tournaments.length} torneos encontrados`}
          </p>
          {(q || province) && (
            <Link href="/explorar" className="font-medium text-indigo-600 hover:text-indigo-700">
              Limpiar filtros
            </Link>
          )}
        </div>

        {tournaments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <h2 className="text-xl font-semibold text-gray-900">
              No hay torneos para esos filtros
            </h2>
            <p className="mt-3 text-gray-600">
              Prueba otra búsqueda o amplía la provincia. Aquí solo salen torneos públicos y
              publicados.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {tournaments.map((tournament) => {
              const badge = getExploreStatus(tournament)

              return (
                <article
                  key={tournament.id}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative flex aspect-[16/10] items-center justify-center bg-gray-100">
                    {tournament.poster_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tournament.poster_url}
                        alt={tournament.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-sm text-gray-500">Sin cartel</div>
                    )}
                  </div>

                  <div className="space-y-5 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs font-medium text-gray-500">
                        {tournament.province ?? "Provincia por definir"}
                      </span>
                    </div>

                    <div>
                      <h2 className="line-clamp-2 text-xl font-semibold tracking-tight text-gray-900">
                        {tournament.title}
                      </h2>
                      <p className="mt-2 text-sm text-gray-500">{formatDate(tournament.date)}</p>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <p>{getStructureLabel(tournament)}</p>
                      <p>{getCapacityLabel(tournament)}</p>
                      <p>{getPriceLabel(tournament)}</p>
                      <p>{paymentMethodLabel(tournament.payment_method)}</p>
                      <p>Límite de inscripción: {formatDate(tournament.registration_deadline)}</p>
                    </div>

                    <Link
                      href={`/torneos/${tournament.id}`}
                      className="btn-primary block w-full text-center"
                    >
                      Ver torneo
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}