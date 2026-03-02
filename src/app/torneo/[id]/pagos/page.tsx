import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import PaymentConfig from "./payment-config"

export default async function PagosPage({
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
    .select("id, organizer_id, status, payment_method")
    .eq("id", id)
    .single()

  if (!tournament || tournament.organizer_id !== user.id) {
    redirect("/")
  }

  if (tournament.status !== "draft") {
    redirect(`/torneo/${id}`)
  }

  return (
    <div className="container-custom py-16">
      <h1 className="text-3xl font-bold mb-8">
        Configuración de Pagos
      </h1>

      <PaymentConfig
        tournamentId={id}
        currentMethod={tournament.payment_method}
      />
    </div>
  )
}