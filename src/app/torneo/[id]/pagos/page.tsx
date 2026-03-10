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
    .select("id, organizer_id, status, payment_method, has_categories, title")
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
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Configuración de Pagos</h1>
        <p className="text-gray-600 mb-8">
          Define cómo se pagarán las inscripciones. Puedes permitir pago en efectivo, online, o ambas opciones.
          <span className="block mt-2 text-sm text-gray-500">
            Nota: el cobro online (Stripe) lo implementaremos después. Por ahora esto deja configurado el método.
          </span>
        </p>

        <PaymentConfig
          tournamentId={id}
          currentMethod={tournament.payment_method}
        />
      </div>
    </div>
  )
}