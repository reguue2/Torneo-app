import { NextResponse } from "next/server"
import { runAutomaticStateSync } from "@/lib/tournaments/server"

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  const authorization = request.headers.get("authorization")
  const headerSecret = request.headers.get("x-cron-secret")

  return authorization === `Bearer ${cronSecret}` || headerSecret === cronSecret
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runAutomaticStateSync()
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}