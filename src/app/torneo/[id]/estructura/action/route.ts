import { NextRequest, NextResponse } from "next/server"
import { resolveLegacyTournamentRedirectPath } from "@/lib/tournaments/legacy-routes"

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const redirectPath = await resolveLegacyTournamentRedirectPath(id)

  return NextResponse.redirect(new URL(redirectPath, req.url))
}