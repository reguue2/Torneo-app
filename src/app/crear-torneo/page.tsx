import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import CreateTournamentForm from "./tournament-form"

export default async function CrearTorneoPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="container-custom py-16">
      <h1 className="text-3xl font-bold mb-2">Crear Torneo</h1>
      <p className="text-gray-600 mb-10">
        Configura tu torneo y comienza a aceptar inscripciones
      </p>

      <CreateTournamentForm userId={user.id} />
    </div>
  )
}