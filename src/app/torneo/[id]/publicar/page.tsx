import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import PublishClient from "./publish-client"

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

export default async function PublicarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single()

  if (!tournament || tournament.organizer_id !== user.id) redirect("/")
  if (tournament.status !== "draft") redirect(`/torneo/${id}`)

  let categories: Category[] = []

  if (tournament.has_categories) {
    const { data } = await supabase
      .from("categories")
      .select("id,name,price,min_participants,max_participants,start_at,address,prizes").eq("tournament_id", id)
      .order("name", { ascending: true })

    categories = (data as Category[]) || []
  }

  // =========================
  // Validación cupos
  // =========================
  const tournamentCapacityOk =
    typeof tournament.min_participants === "number" &&
    tournament.min_participants > 0 &&
    (tournament.max_participants === null ||
      (typeof tournament.max_participants === "number" &&
        tournament.max_participants >= tournament.min_participants))

  const categoriesOk = !tournament.has_categories
    ? true
    : categories.length > 0 &&
    categories.every(
      (c) =>
        typeof c.min_participants === "number" &&
        c.min_participants > 0 &&
        (c.max_participants === null ||
          (typeof c.max_participants === "number" && c.max_participants >= c.min_participants))
    )

  // =========================
  // ✅ Validación precio (solo sin categorías)
  // =========================
  const entryPriceOk = tournament.has_categories
    ? true
    : typeof tournament.entry_price === "number" &&
    Number.isFinite(tournament.entry_price) &&
    tournament.entry_price >= 0

  // =========================
  // Validación premios
  // =========================
  const prizeMode = tournament.prize_mode as "none" | "global" | "per_category" | null
  const hasPrizeGlobal = !!(tournament.prizes && String(tournament.prizes).trim())
  const hasPrizePerCategory =
    !tournament.has_categories
      ? false
      : categories.length > 0 && categories.every((c) => !!(c.prizes && c.prizes.trim()))

  const prizesOk =
    prizeMode === "none"
      ? true
      : prizeMode === "global"
        ? hasPrizeGlobal
        : prizeMode === "per_category"
          ? hasPrizePerCategory
          : true

  // =========================
  // Validaciones generales
  // =========================
  const validation = {
    hasPaymentMethod: !!tournament.payment_method,
    hasDate: !!tournament.date,
    hasDeadline: !!tournament.registration_deadline,
    capacityOk: tournament.has_categories ? categoriesOk : tournamentCapacityOk,
    hasCategories: !tournament.has_categories ? true : categories.length > 0,
    prizesOk,
    entryPriceOk,
  }

  const canPublish =
    validation.hasPaymentMethod &&
    validation.hasDate &&
    validation.hasDeadline &&
    validation.capacityOk &&
    validation.hasCategories &&
    validation.prizesOk &&
    validation.entryPriceOk

  return (
    <div className="container-custom py-16">
      <h1 className="text-3xl font-bold mb-8">Publicar Torneo</h1>

      <PublishClient
        tournament={tournament}
        categories={categories}
        canPublish={canPublish}
      />
    </div>
  )
}