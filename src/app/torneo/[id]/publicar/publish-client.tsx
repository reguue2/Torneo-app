"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Image from "next/image"

type Category = {
  id: string
  name: string
  price: number
  min_participants: number
  max_participants: number | null
  start_at: string | null
  city: string | null
  address: string | null
  prizes: string | null
}

export default function PublishClient({
  tournament,
  categories,
  canPublish,
}: {
  tournament: any
  categories: Category[]
  canPublish: boolean
}) {
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

  const formatDate = (d: string | null) => {
    if (!d) return "—"
    const dt = new Date(d)
    return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString()
  }

  const capacityLabel = () => {
    if (tournament.has_categories) return "Cupos por categoría"
    const min = tournament.min_participants ?? 1
    const max = tournament.max_participants
    return `Cupo del torneo: min ${min} · ${max === null ? "sin máximo" : `max ${max}`}`
  }

  const paymentMethodLabel = (m: string | null) => {
    if (!m) return "—"
    if (m === "cash") return "Solo efectivo"
    if (m === "online") return "Solo pago online"
    if (m === "both") return "Efectivo y pago online"
    return m
  }

  const formatMoney = (n: any) => {
    const value = typeof n === "number" ? n : Number(n)
    if (!Number.isFinite(value)) return "—"
    if (value === 0) return "Gratis"
    // 10 -> 10€ | 10.5 -> 10.50€
    const str =
      Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "")
    return `${str}€`
  }

  const prizeMode = tournament.prize_mode as "none" | "global" | "per_category" | null

  return (
    <div className="space-y-10">
      <div className="card space-y-6">
        <h2 className="text-lg font-semibold">Resumen del Torneo</h2>

        {tournament.poster_url && (
          <div className="relative w-full h-56 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
            <Image
              src={tournament.poster_url}
              alt="Cartel del torneo"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
        )}

        <div>
          <h3 className="font-semibold text-xl">{tournament.title}</h3>
          <p className="text-sm text-gray-500">
            {(tournament.city ?? "—")} · {formatDate(tournament.date)}
          </p>
        </div>

        <div className="text-sm text-gray-600 space-y-1">
          <div>
            <span className="font-medium">Estructura:</span>{" "}
            {tournament.has_categories ? "Con categorías" : "Sin categorías"}
          </div>
          <div>
            <span className="font-medium">Cupos:</span> {capacityLabel()}
          </div>

          {/* ✅ Precio */}
          <div>
            <span className="font-medium">Precio:</span>{" "}
            {tournament.has_categories ? "Por categoría" : formatMoney(tournament.entry_price)}
          </div>
        </div>

        {/* Si hay categorías, lista precios por categoría */}
        {tournament.has_categories && (
          <div className="text-sm text-gray-600">
            <h3 className="font-semibold mb-2">Precios por categoría</h3>

            {categories.length === 0 ? (
              <p className="text-gray-500">—</p>
            ) : (
              <div className="grid gap-3">
                {categories.map((c) => (
                  <div key={c.id} className="border rounded-lg p-3 flex items-center justify-between gap-4">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <span className="text-sm text-gray-700">{formatMoney(c.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Premios */}
        <div className="text-sm text-gray-600">
          <h3 className="font-semibold mb-2">Premios</h3>

          {prizeMode === "none" && <p>Sin premios</p>}

          {prizeMode === "global" && (
            <p className="whitespace-pre-wrap">{tournament.prizes ?? "—"}</p>
          )}

          {prizeMode === "per_category" && (
            <div className="grid gap-3">
              {categories.map((c) => (
                <div key={c.id} className="border rounded-lg p-3">
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">
                    {c.prizes ?? "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Normativa */}
        <div>
          <h3 className="font-semibold mb-2">Reglas / Normativa</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{tournament.rules ?? "—"}</p>
        </div>

        {/* Método de pago */}
        <div>
          <h3 className="font-semibold mb-2">Método de pago</h3>
          <p className="text-sm text-gray-600">{paymentMethodLabel(tournament.payment_method)}</p>

          {(tournament.payment_method === "online" || tournament.payment_method === "both") && (
            <p className="text-xs text-gray-500 mt-2">
              Nota: el cobro online (Stripe) se implementará más adelante. Por ahora esto solo configura el método.
            </p>
          )}
        </div>
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