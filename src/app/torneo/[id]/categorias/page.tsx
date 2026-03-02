import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import CategoriesManager from "./categories-manager"

export default async function CategoriasPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", params.id)
    .single()

  if (!tournament || tournament.organizer_id !== user.id) {
    redirect("/")
  }

  return (
    <div className="container-custom py-16">
      <h1 className="text-3xl font-bold mb-2">Categorías</h1>
      <p className="text-gray-600 mb-10">
        Configura las categorías del torneo
      </p>

      <CategoriesManager tournamentId={params.id} />
    </div>
  )
}