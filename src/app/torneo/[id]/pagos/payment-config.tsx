"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

type PaymentMethod = "cash" | "online" | "both"

export default function PaymentConfig({
  tournamentId,
  currentMethod,
}: {
  tournamentId: string
  currentMethod: PaymentMethod | null
}) {
  const supabase = createClient()
  const router = useRouter()

  const [method, setMethod] = useState<PaymentMethod | null>(
    currentMethod
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const save = async () => {
    setError(null)

    if (!method) {
      setError("Debes seleccionar un método de pago")
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase
      .from("tournaments")
      .update({ payment_method: method })
      .eq("id", tournamentId)

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.push(`/torneo/${tournamentId}/publicar`)
  }

  return (
    <div className="space-y-10">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="card space-y-6">
        <h2 className="text-lg font-semibold">
          Selecciona el método de pago
        </h2>

        <div className="space-y-4">
          <Option
            selected={method === "cash"}
            onClick={() => setMethod("cash")}
            title="Solo efectivo"
            description="Los participantes pagarán el día del torneo."
          />

          <Option
            selected={method === "online"}
            onClick={() => setMethod("online")}
            title="Solo pago online"
            description="Los participantes pagarán con tarjeta."
          />

          <Option
            selected={method === "both"}
            onClick={() => setMethod("both")}
            title="Efectivo y pago online"
            description="Permitir ambas opciones."
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? "Guardando..." : "Continuar"}
        </button>
      </div>
    </div>
  )
}

function Option({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean
  onClick: () => void
  title: string
  description: string
}) {
  return (
    <div
      onClick={onClick}
      className={`p-4 border rounded-lg cursor-pointer transition ${
        selected
          ? "border-indigo-600 bg-indigo-50"
          : "border-gray-300 hover:border-gray-400"
      }`}
    >
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">
        {description}
      </p>
    </div>
  )
}