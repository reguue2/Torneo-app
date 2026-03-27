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
    .select("id, organizer_id, status, has_categories")
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
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold">¿Cómo quieres estructurar tu torneo?</h1>
        <p className="text-gray-600 mt-2">
          Esto define si los participantes se inscriben en una única modalidad o si deben elegir una
          categoría al apuntarse.
        </p>

        <form
          action={`/torneo/${id}/estructura/action`}
          method="POST"
          className="mt-10 space-y-6"
        >
          <div className="space-y-4">
            <label className="structure-option">
              <div className="structure-card">
                <input
                  type="radio"
                  name="structure"
                  value="with"
                  className="structure-radio"
                  defaultChecked={tournament.has_categories ?? true}
                />

                <div className="structure-content">
                  <div className="structure-main">
                    <div className="structure-dot">
                      <div className="structure-dot-inner" />
                    </div>

                    <div className="flex-1">
                      <p className="font-semibold text-lg">Con categorías</p>
                      <p className="text-gray-600 text-sm mt-1">
                        Ideal si quieres separar por edad, género o nivel. Ejemplos:
                        <span className="font-medium">
                          {" "}
                          “Infantil / Senior”, “Sub-18 / Absoluto”, “Femenino / Masculino”
                        </span>
                        .
                      </p>

                      <ul className="text-sm text-gray-500 mt-3 space-y-1 list-disc list-inside">
                        <li>Los participantes eligen categoría al inscribirse</li>
                        <li>Cada categoría puede tener su propio precio y cupo</li>
                        <li>Opcional: fecha/ubicación diferente por categoría</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </label>

            <label className="structure-option">
              <div className="structure-card">
                <input
                  type="radio"
                  name="structure"
                  value="without"
                  className="structure-radio"
                  defaultChecked={tournament.has_categories === false}
                />

                <div className="structure-content">
                  <div className="structure-main">
                    <div className="structure-dot">
                      <div className="structure-dot-inner" />
                    </div>

                    <div className="flex-1">
                      <p className="font-semibold text-lg">Sin categorías</p>
                      <p className="text-gray-600 text-sm mt-1">
                        Torneo de una sola modalidad. Todos se inscriben al mismo torneo sin elegir nada
                        extra.
                      </p>

                      <ul className="text-sm text-gray-500 mt-3 space-y-1 list-disc list-inside">
                        <li>Inscripción más rápida (sin selección de categoría)</li>
                        <li>Un único listado de inscritos</li>
                        <li>Configurarás los cupos en el siguiente paso</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="submit" className="btn-primary">
              Continuar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}