import { createClient } from "@/lib/supabase/server"
import type { TournamentStatus } from "@/lib/tournaments/management"

type TournamentAccessRow = {
  id: string
  organizer_id: string
  status: TournamentStatus | null
}

export async function resolveLegacyTournamentRedirectPath(tournamentId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return "/login"
  }

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, organizer_id, status")
    .eq("id", tournamentId)
    .single<TournamentAccessRow>()

  if (!tournament || tournament.organizer_id !== user.id) {
    return "/"
  }

  if (tournament.status === "draft") {
    return "/crear-torneo"
  }

  return `/torneo/${tournamentId}/gestionar`
}