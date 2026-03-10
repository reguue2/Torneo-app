import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import CategoriesManager from "./categories-manager"

export default async function CategoriasPage({
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
    .select("id, organizer_id, status, has_categories, title")
    .eq("id", id)
    .single()

  if (!tournament || tournament.organizer_id !== user.id) {
    redirect("/")
  }

  // Nuevo flujo: sin categorías -> cupos -> detalles -> pagos
  if (!tournament.has_categories) {
    redirect(`/torneo/${id}/cupos`)
  }

  if (tournament.status !== "draft") {
    redirect(`/torneo/${id}`)
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("tournament_id", id)
    .order("name", { ascending: true })
    .throwOnError()

  return (
    <div className="container-custom py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold">Categorías</h1>
        <p className="text-gray-600 mt-2">
          Crea las categorías en las que se podrán inscribir los participantes. En cada categoría puedes definir{" "}
          <span className="font-medium">precio</span> y{" "}
          <span className="font-medium">cupo (mínimo/máximo)</span>. Además, si lo necesitas, puedes poner{" "}
          <span className="font-medium">fecha y ubicación</span> propias por categoría.
        </p>

        <div className="mt-10">
          <CategoriesManager tournamentId={id} initialCategories={categories || []} />
        </div>
      </div>
    </div>
  )
}