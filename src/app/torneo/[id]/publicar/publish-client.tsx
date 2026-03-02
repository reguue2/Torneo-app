"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function PublishClient({
  tournament,
  categories,
  validation,
  canPublish,
}: any) {
  const supabase = createClient()
  const router = useRouter()

  const publish = async () => {
    if (!canPublish) return

    const { error } = await supabase
      .from("tournaments")
      .update({ status: "published" })
      .eq("id", tournament.id)

    if (error) return

    router.push("/explorar")
  }

  return (
    <div className="space-y-10">

      {/* RESUMEN */}
      <div className="card space-y-6">
        <h2 className="text-lg font-semibold">
          Resumen del Torneo
        </h2>

        {tournament.poster_url && (
          <div className="relative h-40 w-full">
            <Image
              src={tournament.poster_url}
              alt="Poster"
              fill
              className="object-cover rounded-lg"
            />
          </div>
        )}

        <div>
          <h3 className="font-semibold text-xl">
            {tournament.title}
          </h3>
          <p className="text-sm text-gray-500">
            {tournament.city} ·{" "}
            {new Date(tournament.date).toLocaleDateString()}
          </p>
        </div>

        {tournament.has_categories && (
          <div>
            <h3 className="font-semibold mb-2">
              Categorías
            </h3>

            {categories.map((cat: any) => (
              <div
                key={cat.id}
                className="border rounded-lg p-3 text-sm"
              >
                {cat.name} · {cat.price}€ ·{" "}
                {cat.max_teams} equipos ·{" "}
                {cat.min_players}-{cat.max_players} jugadores
              </div>
            ))}
          </div>
        )}

        <div>
          <h3 className="font-semibold mb-2">
            Método de pago
          </h3>
          <p className="text-sm text-gray-600">
            {tournament.payment_method}
          </p>
        </div>
      </div>

      {/* VALIDACIONES */}
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">
          Validaciones
        </h2>

        <ValidationItem
          valid={validation.hasPaymentMethod}
          text="Método de pago configurado"
        />

        <ValidationItem
          valid={validation.hasDate}
          text="Fecha del torneo definida"
        />

        <ValidationItem
          valid={validation.hasDeadline}
          text="Fecha límite definida"
        />

        <ValidationItem
          valid={validation.hasMaxParticipants}
          text="Máximo de participantes válido"
        />

        {tournament.has_categories && (
          <ValidationItem
            valid={validation.hasCategories}
            text="Tiene al menos una categoría"
          />
        )}
      </div>

      <div className="flex justify-end">
        <button
          disabled={!canPublish}
          onClick={publish}
          className={`px-6 py-3 rounded-lg font-medium ${
            canPublish
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          Publicar Torneo
        </button>
      </div>
    </div>
  )
}

function ValidationItem({
  valid,
  text,
}: {
  valid: boolean
  text: string
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        className={`w-3 h-3 rounded-full ${
          valid ? "bg-green-500" : "bg-red-500"
        }`}
      />
      {text}
    </div>
  )
}