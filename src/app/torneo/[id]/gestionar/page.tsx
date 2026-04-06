import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import ManageDashboard from "./manage-dashboard"
import type {
  CategoryRow,
  ParticipantRow,
  PaymentRow,
  RegistrationRow,
  TournamentRow,
} from "@/lib/tournaments/management"

export default async function GestionarTorneoPage({
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

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select(`
      id,
      organizer_id,
      title,
      description,
      rules,
      province,
      address,
      date,
      registration_deadline,
      status,
      has_categories,
      payment_method,
      is_public,
      min_participants,
      max_participants,
      entry_price
    `)
    .eq("id", id)
    .single<TournamentRow & { organizer_id: string }>()

  if (tournamentError || !tournament || tournament.organizer_id !== user.id) {
    redirect("/")
  }

  if (tournament.status === "draft") {
    redirect("/mis-torneos")
  }

  const { data: categoriesData, error: categoriesError } = await supabase
    .from("categories")
    .select("id,tournament_id,name,price,min_participants,max_participants")
    .eq("tournament_id", id)
    .order("name", { ascending: true })
    .returns<CategoryRow[]>()

  if (categoriesError) {
    throw new Error(categoriesError.message)
  }

  const { data: registrationsData, error: registrationsError } = await supabase
    .from("registrations")
    .select(`
      id,
      tournament_id,
      category_id,
      participant_id,
      status,
      payment_method,
      public_reference,
      created_at,
      cancelled_at
    `)
    .eq("tournament_id", id)
    .order("created_at", { ascending: false })
    .returns<RegistrationRow[]>()

  if (registrationsError) {
    throw new Error(registrationsError.message)
  }

  const categories = categoriesData ?? []
  const registrations = registrationsData ?? []

  const participantIds = registrations.map((registration) => registration.participant_id)
  const registrationIds = registrations.map((registration) => registration.id)

  let participants: ParticipantRow[] = []
  let payments: PaymentRow[] = []

  if (participantIds.length > 0) {
    const { data: participantsData, error: participantsError } = await supabase
      .from("participants")
      .select("id,type,display_name,contact_phone,contact_email")
      .in("id", participantIds)
      .returns<ParticipantRow[]>()

    if (participantsError) {
      throw new Error(participantsError.message)
    }

    participants = participantsData ?? []
  }

  if (registrationIds.length > 0) {
    const { data: paymentsData, error: paymentsError } = await supabase
      .from("payments")
      .select("id,registration_id,amount,payment_method,status,paid_at,created_at")
      .in("registration_id", registrationIds)
      .returns<PaymentRow[]>()

    if (paymentsError) {
      throw new Error(paymentsError.message)
    }

    payments = paymentsData ?? []
  }

  return (
    <div className="section-spacing">
      <div className="container-custom">
        <ManageDashboard
          tournament={tournament}
          categories={categories}
          registrations={registrations}
          participants={participants}
          payments={payments}
        />
      </div>
    </div>
  )
}