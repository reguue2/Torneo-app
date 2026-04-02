import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import CreateTournamentForm from "./tournament-form"

export default async function CrearTorneoPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return (
    <div className="container-custom py-16">
      <h1 className="mb-2 text-3xl font-bold">Crear torneo</h1>
      <p className="mb-10 max-w-3xl text-gray-600">
        Este flujo ya no crea borradores en base de datos. Todo se prepara en cliente
        y solo se persiste cuando pulsas publicar.
      </p>
      <CreateTournamentForm />
    </div>
  )
}