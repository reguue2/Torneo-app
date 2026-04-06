import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import RegisterForm from "./register-form"
import {
  formatDate,
  formatMoney,
  getPublicVisibilityLabel,
  getRegistrationState,
} from "@/lib/tournaments/domain"

type ParticipantType = "individual" | "team"

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

type Tournament = {
  id: string
  title: string
  province: string | null
  address: string | null
  date: string | null
  registration_deadline: string | null
  status: "draft" | "published" | "closed" | "finished" | "cancelled" | null
  has_categories: boolean
  participant_type: ParticipantType | null
  payment_method: "cash" | "online" | "both" | null
  entry_price: number
  is_public: boolean | null
}

const VISIBLE_PUBLIC_STATUSES: Array<
  "published" | "closed" | "finished" | "cancelled"
> = ["published", "closed", "finished", "cancelled"]

function getParticipantTypeLabel(value: ParticipantType | null) {
  if (value === "team") return "Equipos"
  if (value === "individual") return "Individual"
  return "Por definir"
}

export default async function InscribirsePage({
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
      province,
      address,
      date,
      registration_deadline,
      status,
      has_categories,
      participant_type,
      payment_method,
      entry_price,
      is_public
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
      .select(
        "id,name,participant_type,price,min_participants,max_participants,start_at,address"
      )
      .eq("tournament_id", id)
      .order("name", { ascending: true })

    categories = (data as Category[]) ?? []
  }

  const registrationState = getRegistrationState(tournament as Tournament)
  const hasValidParticipantConfig = tournament.has_categories
    ? categories.length > 0 && categories.every((category) => Boolean(category.participant_type))
    : Boolean(tournament.participant_type)

  return (
    <div className="section-spacing">
      <div className="container-custom space-y-8">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Link href={`/torneos/${id}`} className="hover:text-gray-900 transition-colors">
            Volver al torneo
          </Link>
          <span>/</span>
          <span className="truncate">Inscripción</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                Inscribirse al torneo
              </h1>
              <p className="mt-3 text-lg text-gray-600">{tournament.title}</p>
            </div>

            <div className="card space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {registrationState.title}
                </h2>
                <p className="mt-2 text-sm text-gray-600">{registrationState.message}</p>
              </div>

              {registrationState.canJoin && hasValidParticipantConfig ? (
                <RegisterForm
                  tournamentId={tournament.id}
                  tournamentTitle={tournament.title}
                  hasCategories={tournament.has_categories}
                  tournamentParticipantType={tournament.participant_type}
                  categories={categories}
                  entryPrice={tournament.entry_price}
                  paymentMethod={tournament.payment_method}
                />
              ) : registrationState.canJoin ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  El organizador todavía no ha terminado de configurar el formato de inscripción.
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Ahora mismo no puedes completar la inscripción desde esta página.
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card sticky top-24 space-y-5">
              <div>
                <p className="text-sm text-gray-500">Torneo</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{tournament.title}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Ubicación</p>
                <p className="mt-1 text-sm text-gray-700">
                  {tournament.province ?? "Por definir"}
                  {tournament.address ? ` · ${tournament.address}` : ""}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Fecha</p>
                <p className="mt-1 text-sm text-gray-700">{formatDate(tournament.date)}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Fecha límite de inscripción</p>
                <p className="mt-1 text-sm text-gray-700">
                  {formatDate(tournament.registration_deadline)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Precio base</p>
                <p className="mt-1 text-sm text-gray-700">
                  {tournament.has_categories ? "Según categoría" : formatMoney(tournament.entry_price)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Formato de inscripción</p>
                <p className="mt-1 text-sm text-gray-700">
                  {tournament.has_categories
                    ? "Según categoría"
                    : getParticipantTypeLabel(tournament.participant_type)}
                </p>
              </div>

              {tournament.has_categories && categories.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500">Categorías disponibles</p>
                  <div className="mt-2 space-y-2 text-sm text-gray-700">
                    {categories.map((category) => (
                      <div key={category.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <p className="font-medium text-gray-900">{category.name}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {getParticipantTypeLabel(category.participant_type)} · {formatMoney(category.price)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500">Visibilidad</p>
                <p className="mt-1 text-sm text-gray-700">
                  {getPublicVisibilityLabel(tournament.is_public)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500">Cómo funciona ahora</p>
                <p className="mt-1 text-sm text-gray-700">
                  Primero validas el email. Después se crea la inscripción real y, si corresponde,
                  el organizador validará el pago en efectivo o seguirás el flujo online cuando
                  esté conectado.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}