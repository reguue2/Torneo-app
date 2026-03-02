import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import PublishClient from "./publish-client"

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

  if (!tournament || tournament.organizer_id !== user.id) {
    redirect("/")
  }

  if (tournament.status !== "draft") {
    redirect(`/torneo/${id}`)
  }

  let categories: any[] = []

  if (tournament.has_categories) {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("tournament_id", id)

    categories = data || []
  }

  const validation = {
    hasPaymentMethod: !!tournament.payment_method,
    hasDate: !!tournament.date,
    hasDeadline: !!tournament.registration_deadline,
    hasMaxParticipants:
      tournament.max_participants &&
      tournament.max_participants > 0,
    hasCategories: !tournament.has_categories
      ? true
      : categories.length > 0,
  }

  const canPublish =
    validation.hasPaymentMethod &&
    validation.hasDate &&
    validation.hasDeadline &&
    validation.hasMaxParticipants &&
    validation.hasCategories

  return (
    <div className="container-custom py-16">
      <h1 className="text-3xl font-bold mb-8">
        Publicar Torneo
      </h1>

      <PublishClient
        tournament={tournament}
        categories={categories}
        validation={validation}
        canPublish={canPublish}
      />
    </div>
  )
}