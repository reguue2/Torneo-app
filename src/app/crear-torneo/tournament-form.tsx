"use client"

import { useState } from "react"
import { createTournament } from "./actions"

export default function CreateTournamentForm() {
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen válida.")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("El cartel no puede superar los 5MB.")
      return
    }

    setError(null)
    setPreview(URL.createObjectURL(file))
  }

  const validateBeforeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget
    const date = new Date((form.date as any).value)
    const deadline = new Date((form.registration_deadline as any).value)
    const maxParticipants = Number((form.max_participants as any).value)

    if (deadline > date) {
      e.preventDefault()
      setError("La fecha límite no puede ser posterior al torneo.")
      return
    }

    if (maxParticipants <= 0) {
      e.preventDefault()
      setError("El máximo de participantes debe ser mayor a 0.")
      return
    }

    setError(null)
    setLoading(true)
  }

  return (
    <form
      action={createTournament}
      onSubmit={validateBeforeSubmit}
      className="space-y-10"
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* ================= INFORMACIÓN BÁSICA ================= */}
      <div className="card space-y-6">
        <h2 className="text-lg font-semibold">Información Básica</h2>

        {/* Poster */}
        <div>
          <label className="block mb-2 font-medium">
            Cartel del torneo *
          </label>

          <input
            type="file"
            name="poster"
            accept="image/png, image/jpeg"
            onChange={handleFileChange}
            required
          />

          {preview && (
            <img
              src={preview}
              className="mt-4 h-48 object-cover rounded-lg border"
            />
          )}

          <p className="text-sm text-gray-500 mt-2">
            PNG o JPG (máx. 5MB)
          </p>
        </div>

        {/* Título */}
        <div>
          <label className="block mb-2 font-medium">
            Título del torneo *
          </label>
          <input
            name="title"
            required
            className="input"
            placeholder="Ej: Campeonato de Pádel Verano 2026"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block mb-2 font-medium">
            Descripción
          </label>
          <textarea
            name="description"
            className="input"
            rows={3}
            placeholder="Describe brevemente el torneo..."
          />
        </div>

        {/* Ciudad y Dirección */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-2 font-medium">Ciudad</label>
            <input
              name="city"
              className="input"
              placeholder="Ej: Logroño"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium">Dirección</label>
            <input
              name="address"
              className="input"
              placeholder="Ej: Polideportivo Las Gaunas"
            />
          </div>
        </div>

        {/* Fechas */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-2 font-medium">
              Fecha del torneo *
            </label>
            <input
              type="date"
              name="date"
              required
              className="input"
            />
            <p className="text-sm text-gray-500 mt-1">
              Día en que se disputará el torneo.
            </p>
          </div>

          <div>
            <label className="block mb-2 font-medium">
              Fecha límite inscripción *
            </label>
            <input
              type="date"
              name="registration_deadline"
              required
              className="input"
            />
            <p className="text-sm text-gray-500 mt-1">
              Último día para que los jugadores se inscriban.
            </p>
          </div>
        </div>

        {/* Máximo participantes */}
        <div>
          <label className="block mb-2 font-medium">
            Máximo de participantes *
          </label>
          <input
            type="number"
            name="max_participants"
            min="1"
            required
            className="input"
            placeholder="Ej: 32"
          />
          <p className="text-sm text-gray-500 mt-1">
            Límite total de participantes en el torneo.
          </p>
        </div>
      </div>

      {/* ================= DETALLES ================= */}
      <div className="card space-y-6">
        <h2 className="text-lg font-semibold">Detalles</h2>

        <div>
          <label className="block mb-2 font-medium">Premios</label>
          <input
            name="prizes"
            className="input"
            placeholder="Ej: 1º 500€, 2º 300€..."
          />
        </div>

        <div>
          <label className="block mb-2 font-medium">
            Reglas / Normativa
          </label>
          <textarea
            name="rules"
            className="input"
            rows={4}
            placeholder="Especifica las reglas del torneo..."
          />
        </div>
      </div>

      {/* ================= VISIBILIDAD ================= */}
      <div className="card flex justify-between items-center">
        <div>
          <p className="font-medium">Torneo Público</p>
          <p className="text-sm text-gray-500">
            Si está activo, aparecerá en la sección Explorar Torneos.
          </p>
        </div>

        <input
          type="checkbox"
          name="is_public"
          defaultChecked
          className="scale-125"
        />
      </div>

      {/* ================= BOTÓN ================= */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
        >
          {loading ? "Creando..." : "Continuar"}
        </button>
      </div>
    </form>
  )
}