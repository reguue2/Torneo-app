import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const formData = await req.formData()
  const structure = formData.get("structure")

  const hasCategories = structure === "with"

  await supabase
    .from("tournaments")
    .update({ has_categories: hasCategories })
    .eq("id", id)
    .eq("organizer_id", user.id)

  if (hasCategories) {
    return NextResponse.redirect(
      new URL(`/torneo/${id}/categorias`, req.url)
    )
  }

  return NextResponse.redirect(
    new URL(`/torneo/${id}/pagos`, req.url)
  )
}