"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface Category {
  id: string
  name: string
  price: number
  max_teams: number
  min_players: number
  max_players: number
}

export default function CategoriesManager({
  tournamentId,
  initialCategories,
}: {
  tournamentId: string
  initialCategories: Category[]
}) {
  const supabase = createClient()
  const router = useRouter()

  const [categories, setCategories] =
    useState<Category[]>(initialCategories)

  const [form, setForm] = useState({
    name: "",
    price: 0,
    max_teams: 1,
    min_players: 1,
    max_players: 1,
  })

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const addCategory = async () => {
    setError(null)

    if (!form.name.trim()) {
      setError("El nombre es obligatorio")
      return
    }

    if (form.price < 0) {
      setError("El precio no puede ser negativo")
      return
    }

    if (form.max_teams < 1) {
      setError("Debe haber al menos 1 equipo")
      return
    }

    if (form.min_players < 1) {
      setError("Mínimo 1 jugador")
      return
    }

    if (form.max_players < form.min_players) {
      setError("El máximo de jugadores no puede ser menor al mínimo")
      return
    }

    setLoading(true)

    const { data, error: insertError } = await supabase
      .from("categories")
      .insert({
        tournament_id: tournamentId,
        name: form.name,
        price: form.price,
        max_teams: form.max_teams,
        min_players: form.min_players,
        max_players: form.max_players,
      })
      .select()
      .single()

    setLoading(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setCategories([...categories, data])
    setForm({
      name: "",
      price: 0,
      max_teams: 1,
      min_players: 1,
      max_players: 1,
    })
  }

  const continueToPayments = () => {
    router.push(`/torneo/${tournamentId}/pagos`)
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
          Nueva Categoría
        </h2>

        <input
          placeholder="Nombre"
          className="input"
          value={form.name}
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
        />

        <div className="grid md:grid-cols-2 gap-6">
          <input
            type="number"
            placeholder="Precio"
            className="input"
            value={form.price}
            onChange={(e) =>
              setForm({ ...form, price: Number(e.target.value) })
            }
          />

          <input
            type="number"
            placeholder="Máx equipos"
            className="input"
            value={form.max_teams}
            onChange={(e) =>
              setForm({
                ...form,
                max_teams: Number(e.target.value),
              })
            }
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <input
            type="number"
            placeholder="Mín jugadores"
            className="input"
            value={form.min_players}
            onChange={(e) =>
              setForm({
                ...form,
                min_players: Number(e.target.value),
              })
            }
          />

          <input
            type="number"
            placeholder="Máx jugadores"
            className="input"
            value={form.max_players}
            onChange={(e) =>
              setForm({
                ...form,
                max_players: Number(e.target.value),
              })
            }
          />
        </div>

        <button
          onClick={addCategory}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? "Añadiendo..." : "Añadir Categoría"}
        </button>
      </div>

      {categories.length > 0 && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold">
            Categorías creadas
          </h2>

          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex justify-between border-b pb-2"
            >
              <span>{cat.name}</span>
              <span>{cat.price}€</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={continueToPayments}
          className="btn-primary"
        >
          Continuar a Pagos
        </button>
      </div>
    </div>
  )
}