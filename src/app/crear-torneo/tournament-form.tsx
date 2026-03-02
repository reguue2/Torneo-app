"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function CreateTournamentForm({
  userId,
}: {
  userId: string
}) {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [posterFile, setPosterFile] = useState<File | null>(null)

  const [form, setForm] = useState({
    title: "",
    description: "",
    prizes: "",
    rules: "",
    city: "",
    address: "",
    date: "",
    registration_deadline: "",
    is_public: true,
  })

  const handleChange = (e: any) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
  }

  const handleSubmit = async () => {
    setLoading(true)

    let posterUrl: string | null = null

    // 1️⃣ Subir imagen si existe
    if (posterFile) {
      const fileExt = posterFile.name.split(".").pop()
      const fileName = `${crypto.randomUUID()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from("tournament-posters")
        .upload(fileName, posterFile)

      if (uploadError) {
        alert(uploadError.message)
        setLoading(false)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("tournament-posters")
        .getPublicUrl(fileName)

      posterUrl = publicUrl
    }

    // 2️⃣ Insertar torneo
    const { data, error } = await supabase
      .from("tournaments")
      .insert({
        organizer_id: userId,
        title: form.title,
        description: form.description,
        prizes: form.prizes,
        rules: form.rules,
        city: form.city,
        address: form.address,
        date: form.date,
        registration_deadline: form.registration_deadline,
        is_public: form.is_public,
        status: "draft",
        poster_url: posterUrl,
      })
      .select()
      .single()

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    router.push(`/torneo/${data.id}/categorias`)
  }

  return (
    <div className="space-y-10">

      {/* INFORMACIÓN BÁSICA */}
      <div className="card space-y-6">
        <h2 className="text-lg font-semibold">Información Básica</h2>

        {/* SUBIDA DE IMAGEN */}
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center">
          <input
            type="file"
            accept="image/png, image/jpeg, image/jpg"
            onChange={(e) =>
              setPosterFile(e.target.files ? e.target.files[0] : null)
            }
          />
          <p className="text-sm text-gray-500 mt-2">
            PNG, JPG o JPEG (máx 5MB recomendado)
          </p>
        </div>

        <input
          name="title"
          placeholder="Título del Torneo"
          className="w-full border border-gray-300 rounded-lg px-4 py-3"
          onChange={handleChange}
        />

        <textarea
          name="description"
          placeholder="Descripción"
          className="w-full border border-gray-300 rounded-lg px-4 py-3"
          onChange={handleChange}
        />

        <div className="grid md:grid-cols-2 gap-6">
          <input
            name="city"
            placeholder="Ciudad"
            className="border border-gray-300 rounded-lg px-4 py-3"
            onChange={handleChange}
          />

          <input
            name="address"
            placeholder="Dirección"
            className="border border-gray-300 rounded-lg px-4 py-3"
            onChange={handleChange}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <input
            type="date"
            name="date"
            className="border border-gray-300 rounded-lg px-4 py-3"
            onChange={handleChange}
          />

          <input
            type="date"
            name="registration_deadline"
            className="border border-gray-300 rounded-lg px-4 py-3"
            onChange={handleChange}
          />
        </div>
      </div>

      {/* DETALLES */}
      <div className="card space-y-6">
        <h2 className="text-lg font-semibold">Detalles del Torneo</h2>

        <input
          name="prizes"
          placeholder="Premios"
          className="w-full border border-gray-300 rounded-lg px-4 py-3"
          onChange={handleChange}
        />

        <textarea
          name="rules"
          placeholder="Reglas / Normativa"
          className="w-full border border-gray-300 rounded-lg px-4 py-3"
          onChange={handleChange}
        />
      </div>

      {/* VISIBILIDAD */}
      <div className="card space-y-6">
        <h2 className="text-lg font-semibold">
          Configuración de Inscripciones
        </h2>

        <div className="flex items-center justify-between">
          <span>Torneo Público</span>
          <input
            type="checkbox"
            checked={form.is_public}
            onChange={(e) =>
              setForm({ ...form, is_public: e.target.checked })
            }
          />
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <button className="btn-secondary">Cancelar</button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? "Creando..." : "Continuar"}
        </button>
      </div>
    </div>
  )
}