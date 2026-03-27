import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import DetallesClient from "./detalles-client"

type CategoryPrize = {
  id: string
  name: string
  prizes: string | null
}

export default async function DetallesPage({
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
    .select("id, organizer_id, status, has_categories, prizes, rules, prize_mode")
    .eq("id", id)
    .single()

  if (!tournament || tournament.organizer_id !== user.id) {
    redirect("/")
  }

  if (tournament.status !== "draft") {
    redirect(`/torneo/${id}`)
  }

  let categories: CategoryPrize[] = []

  if (tournament.has_categories) {
    const { data } = await supabase
      .from("categories")
      .select("id, name, prizes")
      .eq("tournament_id", id)
      .order("name", { ascending: true })

    categories = (data as CategoryPrize[]) || []
  }

  return (
    <div className="container-custom py-16">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold">Detalles del torneo</h1>
        <p className="text-gray-600 mt-2">
          Define premios y normativa. Si el torneo tiene categorías, puedes elegir si los premios son globales
          o específicos por categoría.
        </p>

        <div className="mt-10">
          <DetallesClient
            tournamentId={id}
            hasCategories={!!tournament.has_categories}
            initialPrizes={tournament.prizes ?? ""}
            initialRules={tournament.rules ?? ""}
            initialPrizeMode={tournament.prize_mode ?? "none"}
            initialCategoryPrizes={categories}
          />
        </div>
      </div>
    </div>
  )
}