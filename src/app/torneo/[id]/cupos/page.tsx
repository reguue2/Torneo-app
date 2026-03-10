import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import CuposClient from "./cupos-client"

export default async function CuposPage({
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
    .select("id, organizer_id, status, has_categories, min_participants, max_participants, entry_price")
    .eq("id", id)
    .single()

  if (!tournament || tournament.organizer_id !== user.id) redirect("/")
  if (tournament.status !== "draft") redirect(`/torneo/${id}`)
  if (tournament.has_categories) redirect(`/torneo/${id}/categorias`)

  return (
    <div className="container-custom py-16">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold">Cupos y precio</h1>
        <p className="text-gray-600 mt-2">
          Define el precio de inscripción y los cupos. Si no quieres límite, activa “Sin máximo”.
        </p>

        <div className="mt-10">
          <CuposClient
            tournamentId={id}
            initialMin={null}
            initialMax={tournament.max_participants}
            initialPrice={tournament.entry_price}
          />
        </div>
      </div>
    </div>
  )
}