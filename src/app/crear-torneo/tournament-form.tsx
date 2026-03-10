"use client"

import { useEffect, useRef, useState } from "react"
import { createTournament } from "./actions"

type Field =
  | "poster"
  | "title"
  | "city"
  | "address"
  | "date"
  | "registration_deadline"

type FieldErrors = Partial<Record<Field, string>>

export default function CreateTournamentForm() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const posterBoxRef = useRef<HTMLDivElement | null>(null)

  const titleRef = useRef<HTMLInputElement | null>(null)
  const cityRef = useRef<HTMLInputElement | null>(null)
  const addressRef = useRef<HTMLInputElement | null>(null)
  const dateRef = useRef<HTMLInputElement | null>(null)
  const deadlineRef = useRef<HTMLInputElement | null>(null)

  const [preview, setPreview] = useState<string | null>(null)
  const [previewUrlToRevoke, setPreviewUrlToRevoke] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  useEffect(() => {
    return () => {
      if (previewUrlToRevoke) URL.revokeObjectURL(previewUrlToRevoke)
    }
  }, [previewUrlToRevoke])

  const clearError = (field: Field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const pickFile = () => fileInputRef.current?.click()

  const setPreviewFromFile = (file: File) => {
    // valida
    if (!file.type.startsWith("image/")) {
      setErrors((p) => ({ ...p, poster: "El archivo debe ser una imagen válida." }))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors((p) => ({ ...p, poster: "El cartel no puede superar los 5MB." }))
      return
    }

    clearError("poster")

    // revoca anterior
    if (previewUrlToRevoke) URL.revokeObjectURL(previewUrlToRevoke)

    const url = URL.createObjectURL(file)
    setPreviewUrlToRevoke(url)
    setPreview(url)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null

    // ✅ Si el usuario cancela el diálogo, NO marques error si ya había imagen
    if (!file) return

    setPreviewFromFile(file)
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0] ?? null

    if (!file) return

    // sincroniza el input real para que el file viaje en el FormData
    if (fileInputRef.current) {
      const dt = new DataTransfer()
      dt.items.add(file)
      fileInputRef.current.files = dt.files
    }

    setPreviewFromFile(file)
  }

  const validateBeforeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget
    const nextErrors: FieldErrors = {}

    const file = (form.poster as any)?.files?.[0] as File | undefined
    const title = (form.title as any).value?.trim()
    const city = (form.city as any).value?.trim()
    const address = (form.address as any).value?.trim()
    const dateVal = (form.date as any).value
    const deadlineVal = (form.registration_deadline as any).value

    if (!file) nextErrors.poster = "El cartel es obligatorio."
    if (!title) nextErrors.title = "El título es obligatorio."
    if (!city) nextErrors.city = "La ciudad es obligatoria."
    if (!address) nextErrors.address = "La dirección es obligatoria."
    if (!dateVal) nextErrors.date = "La fecha del torneo es obligatoria."
    if (!deadlineVal) nextErrors.registration_deadline = "La fecha límite es obligatoria."

    if (dateVal && deadlineVal) {
      const date = new Date(dateVal)
      const deadline = new Date(deadlineVal)
      if (deadline > date) {
        nextErrors.registration_deadline = "La fecha límite no puede ser posterior al torneo."
      }
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      e.preventDefault()

      const order: Field[] = [
        "poster",
        "title",
        "city",
        "address",
        "date",
        "registration_deadline",
      ]
      const first = order.find((k) => nextErrors[k])

      if (first) {
        const map: Record<Field, HTMLElement | null> = {
          // ✅ focus útil en el contenedor, no en el input hidden
          poster: posterBoxRef.current,
          title: titleRef.current,
          city: cityRef.current,
          address: addressRef.current,
          date: dateRef.current,
          registration_deadline: deadlineRef.current,
        }

        const el = map[first]
        el?.focus()
        el?.scrollIntoView({ behavior: "smooth", block: "center" })
      }

      return
    }

    setLoading(true)
  }

  return (
    <form
      action={createTournament}
      onSubmit={validateBeforeSubmit}
      className="space-y-10"
      noValidate
    >
      <div className="card space-y-6">
        <h2 className="text-lg font-semibold">Información Básica</h2>

        <div>
          <label className="label">
            Cartel del Torneo <span className="text-red-500">*</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            name="poster"
            accept="image/png, image/jpeg"
            onChange={handleFileChange}
            className="hidden"
          />

          {!preview ? (
            <div
              ref={posterBoxRef}
              role="button"
              tabIndex={0}
              onClick={pickFile}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? pickFile() : null)}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`upload-box ${dragOver ? "upload-box--active" : ""}`}
            >
              <div className="upload-icon" aria-hidden="true">
                ↑
              </div>
              <div className="upload-text">
                <p className="font-medium text-gray-700">Haz clic para subir o arrastra y suelta</p>
                <p className="text-xs text-gray-500">PNG, JPG (máx. 5MB)</p>
              </div>
            </div>
          ) : (
            <div
              ref={posterBoxRef}
              role="button"
              tabIndex={0}
              onClick={pickFile}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? pickFile() : null)}
              className="relative cursor-pointer"
              title="Haz clic para cambiar el cartel"
            >
              <div className="w-full h-56 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                <img
                  src={preview}
                  alt="Cartel del torneo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="absolute inset-0 rounded-xl bg-black/0 hover:bg-black/10 transition" />
            </div>
          )}

          {errors.poster && <p className="field-error">{errors.poster}</p>}
        </div>

        <div>
          <label className="label">
            Título del Torneo <span className="text-red-500">*</span>
          </label>
          <input
            ref={titleRef}
            name="title"
            className={`input ${errors.title ? "input--error" : ""}`}
            placeholder="ej. Campeonato de Fútbol Verano 2026"
            onChange={() => clearError("title")}
          />
          {errors.title && <p className="field-error">{errors.title}</p>}
        </div>

        <div>
          <label className="label">Descripción</label>
          <textarea
            name="description"
            className="textarea"
            rows={3}
            placeholder="Describe brevemente el torneo..."
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="label">
              Ciudad <span className="text-red-500">*</span>
            </label>
            <input
              ref={cityRef}
              name="city"
              className={`input ${errors.city ? "input--error" : ""}`}
              placeholder="Ciudad e instalación"
              onChange={() => clearError("city")}
            />
            {errors.city && <p className="field-error">{errors.city}</p>}
          </div>

          <div>
            <label className="label">
              Dirección <span className="text-red-500">*</span>
            </label>
            <input
              ref={addressRef}
              name="address"
              className={`input ${errors.address ? "input--error" : ""}`}
              placeholder="Dirección exacta"
              onChange={() => clearError("address")}
            />
            {errors.address && <p className="field-error">{errors.address}</p>}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="label">
              Fecha del Torneo <span className="text-red-500">*</span>
            </label>
            <div className="date-field">
              <input
                ref={dateRef}
                type="date"
                name="date"
                className={`input input-date ${errors.date ? "input--error" : ""}`}
                onChange={() => clearError("date")}
              />
            </div>
            {errors.date && <p className="field-error">{errors.date}</p>}
          </div>

          <div>
            <label className="label">
              Fecha Límite de Inscripción <span className="text-red-500">*</span>
            </label>
            <div className="date-field">
              <input
                ref={deadlineRef}
                type="date"
                name="registration_deadline"
                className={`input input-date ${errors.registration_deadline ? "input--error" : ""}`}
                onChange={() => clearError("registration_deadline")}
              />
            </div>
            {errors.registration_deadline && (
              <p className="field-error">{errors.registration_deadline}</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium mb-1">Siguiente paso:</p>
          <p className="text-gray-600">
            Después de crear el torneo, elegirás su estructura (con/sin categorías) y configurarás cupos.
          </p>
        </div>
      </div>

      <div className="card flex justify-between items-center">
        <div>
          <p className="font-medium">Torneo Público</p>
          <p className="text-sm text-gray-500">
            Si está activo, aparecerá en Explorar Torneos.
          </p>
        </div>

        <label className="switch">
          <input type="checkbox" name="is_public" defaultChecked />
          <span className="slider" />
        </label>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Creando..." : "Continuar"}
        </button>
      </div>
    </form>
  )
}