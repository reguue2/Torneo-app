import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function EstructuraPage({
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
    .select("id, organizer_id, status")
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
        ¿Cómo quieres estructurar tu torneo?
      </h1>

      <form
        action={`/torneo/${id}/estructura/action`}
        method="POST"
        className="space-y-6"
      >
        <div className="card space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="radio" name="structure" value="with" defaultChecked />
            <span>Con categorías</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="radio" name="structure" value="without" />
            <span>Sin categorías (modalidad única)</span>
          </label>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary">
            Continuar
          </button>
        </div>
      </form>
    </div>
  )
}