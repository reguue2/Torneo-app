"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function CategoriesManager({
  tournamentId,
}: {
  tournamentId: string
}) {
  const supabase = createClient()
  const router = useRouter()

  const [categories, setCategories] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: "",
    price: 0,
    max_teams: 16,
    min_players: 1,
    max_players: 1,
  })

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("tournament_id", tournamentId)

    setCategories(data || [])
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const handleChange = (e: any) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
  }

  const resetForm = () => {
    setForm({
      name: "",
      price: 0,
      max_teams: 16,
      min_players: 1,
      max_players: 1,
    })
    setEditingId(null)
  }

  const saveCategory = async () => {
    setLoading(true)

    let error

    if (editingId) {
      const response = await supabase
        .from("categories")
        .update({
          name: form.name,
          price: Number(form.price),
          max_teams: Number(form.max_teams),
          min_players: Number(form.min_players),
          max_players: Number(form.max_players),
        })
        .eq("id", editingId)

      error = response.error
    } else {
      const response = await supabase.from("categories").insert({
        tournament_id: tournamentId,
        name: form.name,
        price: Number(form.price),
        max_teams: Number(form.max_teams),
        min_players: Number(form.min_players),
        max_players: Number(form.max_players),
      })

      error = response.error
    }

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    resetForm()
    fetchCategories()
  }

  const editCategory = (cat: any) => {
    setEditingId(cat.id)
    setForm({
      name: cat.name,
      price: cat.price,
      max_teams: cat.max_teams,
      min_players: cat.min_players,
      max_players: cat.max_players,
    })
  }

  const deleteCategory = async (id: string) => {
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id)

    if (error) {
      alert(error.message)
      return
    }

    fetchCategories()
  }

  return (
    <div className="space-y-10">

      {/* Formulario */}
      <div className="card space-y-6">
        <h2 className="text-lg font-semibold">
          {editingId ? "Editar Categoría" : "Añadir Categoría"}
        </h2>

        <input
          name="name"
          placeholder="Nombre (Ej: Absoluto)"
          className="w-full border border-gray-300 rounded-lg px-4 py-3"
          value={form.name}
          onChange={handleChange}
        />

        <div className="grid md:grid-cols-2 gap-6">
          <input
            type="number"
            name="price"
            placeholder="Precio (€)"
            className="border border-gray-300 rounded-lg px-4 py-3"
            value={form.price}
            onChange={handleChange}
          />

          <input
            type="number"
            name="max_teams"
            placeholder="Máx Equipos"
            className="border border-gray-300 rounded-lg px-4 py-3"
            value={form.max_teams}
            onChange={handleChange}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <input
            type="number"
            name="min_players"
            placeholder="Min Jugadores"
            className="border border-gray-300 rounded-lg px-4 py-3"
            value={form.min_players}
            onChange={handleChange}
          />

          <input
            type="number"
            name="max_players"
            placeholder="Max Jugadores"
            className="border border-gray-300 rounded-lg px-4 py-3"
            value={form.max_players}
            onChange={handleChange}
          />
        </div>

        <div className="flex gap-4">
          <button
            onClick={saveCategory}
            disabled={loading}
            className="btn-primary"
          >
            {loading
              ? "Guardando..."
              : editingId
              ? "Actualizar"
              : "Añadir"}
          </button>

          {editingId && (
            <button
              onClick={resetForm}
              className="btn-secondary"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="card space-y-6">
        <h2 className="text-lg font-semibold">Categorías Creadas</h2>

        {categories.length === 0 && (
          <p className="text-gray-500">Aún no hay categorías.</p>
        )}

        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex justify-between items-center border p-4 rounded-lg"
          >
            <div>
              <p className="font-medium">{cat.name}</p>
              <p className="text-sm text-gray-500">
                €{cat.price} · {cat.max_teams} equipos ·{" "}
                {cat.min_players}-{cat.max_players} jugadores
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => editCategory(cat)}
                className="text-indigo-600 text-sm"
              >
                Editar
              </button>

              <button
                onClick={() => deleteCategory(cat.id)}
                className="text-red-500 text-sm"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          disabled={categories.length === 0}
          onClick={() =>
            router.push(`/torneo/${tournamentId}/pagos`)
          }
          className="btn-primary"
        >
          Continuar
        </button>
      </div>
    </div>
  )
}