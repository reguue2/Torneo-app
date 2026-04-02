import { redirect } from "next/navigation"
import { resolveLegacyTournamentRedirectPath } from "@/lib/tournaments/legacy-routes"

export default async function LegacyTournamentRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  redirect(await resolveLegacyTournamentRedirectPath(id))
}