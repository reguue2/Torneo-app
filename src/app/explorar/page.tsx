import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { SPAIN_COMMUNITIES, normalizeText } from "@/lib/spain"

type ExploreSearchParams = Promise<{
  q?: string
  province?: string
}>

type ExploreTournament = {
  id: string
  title: string
  poster_url: string | null
  province: string | null
  date: string | null
  registration_deadline: string | null
  has_categories: boolean
  min_participants: number
  max_participants: number | null
  entry_price: number
  categories?: Array<{
    id: string
    name: string
    price: number
    min_participants: number
    max_participants: number | null
  }>
}

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
  return Number.isInteger(amount) ? `${amount}€` : `${amount.toFixed(2)}€`
}

function getTournamentStatus(deadline: string | null) {
  if (!deadline) return { label: "Abierto", className: "bg-green-500 text-white" }

  const deadlineDate = new Date(deadline)
  if (Number.isNaN(deadlineDate.getTime())) {
    return { label: "Abierto", className: "bg-green-500 text-white" }
  }

  const now = new Date()
  if (deadlineDate < now) {
    return { label: "Cerrado", className: "bg-red-500 text-white" }
  }

  return { label: "Abierto", className: "bg-green-500 text-white" }
}

function getPriceLabel(tournament: ExploreTournament) {
  if (!tournament.has_categories) {
    return formatMoney(tournament.entry_price)
  }

  const prices = (tournament.categories ?? [])
    .map((category) => Number(category.price))
    .filter((price) => Number.isFinite(price))

  if (prices.length === 0) return "Por categoría"

  const minPrice = Math.min(...prices)
  return `Desde ${formatMoney(minPrice)}`
}

function getCapacityLabel(tournament: ExploreTournament) {
  if (!tournament.has_categories) {
    return tournament.max_participants === null
      ? `Mín. ${tournament.min_participants} · Sin máximo`
      : `Mín. ${tournament.min_participants} · Máx. ${tournament.max_participants}`
  }

  return "Cupos por categoría"
}

export default async function ExplorarPage({
  searchParams,
}: {
  searchParams: ExploreSearchParams
}) {
  const { q = "", province = "" } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from("tournaments")
    .select(`
      id,
      title,
      poster_url,
      province,
      date,
      registration_deadline,
      has_categories,
      min_participants,
      max_participants,
      entry_price,
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

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const tournaments = ((data ?? []) as ExploreTournament[]).filter((tournament) => {
    if (!q.trim()) return true
    return normalizeText(tournament.title).includes(normalizeText(q))
  })

  return (
    <div className="section-spacing">
      <div className="container-custom space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Explorar Torneos</h1>
          <p className="mt-3 text-lg text-gray-600">
            Encuentra y únete a torneos locales en tu zona
          </p>
        </div>

        <form method="get" className="card p-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.8fr)]">
            <div>
              <label htmlFor="q" className="sr-only">
                Buscar torneos
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Buscar torneos..."
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
                {SPAIN_COMMUNITIES.map((community) => (
                  <option key={community} value={community}>
                    {community}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              {tournaments.length} {tournaments.length === 1 ? "torneo encontrado" : "torneos encontrados"}
            </p>

            <div className="flex items-center gap-3">
              {(q || province) && (
                <Link href="/explorar" className="btn-secondary px-4 py-2">
                  Limpiar
                </Link>
              )}

              <button type="submit" className="btn-primary px-4 py-2">
                Buscar
              </button>
            </div>
          </div>
        </form>

        {tournaments.length === 0 ? (
          <div className="card text-center py-12">
            <h2 className="text-xl font-semibold">No hay torneos que coincidan</h2>
            <p className="mt-2 text-gray-600">
              Prueba con otro nombre o quita el filtro de provincia.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {tournaments.map((tournament) => {
              const status = getTournamentStatus(tournament.registration_deadline)

              return (
                <article
                  key={tournament.id}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="relative h-56 w-full overflow-hidden bg-gray-100">
                    {tournament.poster_url ? (
                      <img
                        src={tournament.poster_url}
                        alt={tournament.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-gray-500">
                        Sin cartel
                      </div>
                    )}

                    <span
                      className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="space-y-4 p-5">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 line-clamp-2">
                        {tournament.title}
                      </h2>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <p>{tournament.province ?? "Ubicación por definir"}</p>
                      <p>{formatDate(tournament.date)}</p>
                      <p>{getCapacityLabel(tournament)}</p>
                      <p>{getPriceLabel(tournament)}</p>
                    </div>

                    <Link
                      href={`/torneos/${tournament.id}`}
                      className="btn-primary block w-full text-center"
                    >
                      Ver detalles
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