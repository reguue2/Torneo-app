"use client"

import { useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface Category {
  id: string
  name: string
  price: number
  min_participants: number
  max_participants: number | null
  start_at: string | null
  address: string | null
}

type Field =
  | "name"
  | "price"
  | "min_participants"
  | "max_participants"
  | "start_at"
  | "address"

type FieldErrors = Partial<Record<Field, string>>

export default function CategoriesManager({
  tournamentId,
  initialCategories,
}: {
  tournamentId: string
  initialCategories: Category[]
}) {
  const supabase = createClient()
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>(initialCategories)

  // switches
  const [noMax, setNoMax] = useState(false)
  const [customDate, setCustomDate] = useState(false)
  const [customLocation, setCustomLocation] = useState(false)

  const [form, setForm] = useState({
    name: "",
    price: "", // string
    min_participants: "", // string
    max_participants: "", // string
    start_at: "",
    address: "",
  })

  const [errors, setErrors] = useState<FieldErrors>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // error para "Continuar"
  const [continueError, setContinueError] = useState<string | null>(null)
  const topErrorRef = useRef<HTMLDivElement | null>(null)

  // Refs para focus
  const nameRef = useRef<HTMLInputElement | null>(null)
  const priceRef = useRef<HTMLInputElement | null>(null)
  const minRef = useRef<HTMLInputElement | null>(null)
  const maxRef = useRef<HTMLInputElement | null>(null)
  const dateRef = useRef<HTMLInputElement | null>(null)
  const addressRef = useRef<HTMLInputElement | null>(null)

  const clearError = (field: Field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const validate = (): FieldErrors => {
    const next: FieldErrors = {}

    const name = form.name.trim()
    if (!name) next.name = "El nombre es obligatorio."

    // Precio obligatorio (permitimos 0, pero no vacío)
    if (form.price.trim() === "") {
      next.price = "El precio es obligatorio (puede ser 0)."
    } else {
      const price = Number(form.price)
      if (!Number.isFinite(price) || price < 0) next.price = "Introduce un precio válido (>= 0)."
    }

    // Min obligatorio
    if (form.min_participants.trim() === "") {
      next.min_participants = "El mínimo es obligatorio."
    } else {
      const min = Number(form.min_participants)
      if (!Number.isFinite(min) || min < 1) next.min_participants = "El mínimo debe ser al menos 1."
    }

    // Max obligatorio salvo que sea sin máximo
    if (!noMax) {
      if (form.max_participants.trim() === "") {
        next.max_participants = "El máximo es obligatorio o marca “Sin máximo”."
      } else {
        const max = Number(form.max_participants)
        if (!Number.isFinite(max) || max < 1) {
          next.max_participants = "Introduce un máximo válido (>= 1) o marca “Sin máximo”."
        } else {
          const min = Number(form.min_participants)
          if (Number.isFinite(min) && max < min) next.max_participants = "El máximo no puede ser menor que el mínimo."
        }
      }
    }

    // Fecha solo si customDate
    if (customDate) {
      // start_at puede estar vacío y sigue siendo “opcional”, no lo valido como obligatorio
      // Si quisieras obligarlo al activar switch, aquí lo pondrías.
    }

    // Ubicación solo si customLocation
    if (customLocation) {
      // city/address también opcionales incluso activado; no obligo
    }

    return next
  }

  const focusFirstError = (next: FieldErrors) => {
    const order: Field[] = ["name", "price", "min_participants", "max_participants", "start_at", "address"]    
    const first = order.find((k) => next[k])
    if (!first) return

    const map: Record<Field, HTMLElement | null> = {
      name: nameRef.current,
      price: priceRef.current,
      min_participants: minRef.current,
      max_participants: maxRef.current,
      start_at: dateRef.current,
      address: addressRef.current,
    }

    const el = map[first]
    el?.focus()
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  const addCategory = async () => {
    setApiError(null)
    setContinueError(null)

    const next = validate()
    setErrors(next)

    if (Object.keys(next).length > 0) {
      focusFirstError(next)
      return
    }

    const price = Number(form.price)
    const min = Number(form.min_participants)
    const max = noMax ? null : Number(form.max_participants)

    setLoading(true)

    const payload = {
      tournament_id: tournamentId,
      name: form.name.trim(),
      price,
      min_participants: min,
      max_participants: max,
      start_at: customDate && form.start_at ? form.start_at : null,
      address: customLocation && form.address.trim() ? form.address.trim() : null,
    }

    const { data, error: insertError } = await supabase
      .from("categories")
      .insert(payload)
      .select()
      .single()

    setLoading(false)

    if (insertError) {
      setApiError(insertError.message)
      return
    }

    setCategories((prev) => [...prev, data])

    // reset sin inicializar números
    setForm({
      name: "",
      price: "",
      min_participants: "",
      max_participants: "",
      start_at: "",
      address: "",
    })
    setNoMax(false)
    setCustomDate(false)
    setCustomLocation(false)
    setErrors({})
  }

  const deleteCategory = async (id: string) => {
    setApiError(null)
    setContinueError(null)
    setDeletingId(id)

    const { error } = await supabase.from("categories").delete().eq("id", id)

    setDeletingId(null)

    if (error) {
      setApiError(error.message)
      return
    }

    setCategories((prev) => prev.filter((c) => c.id !== id))
  }

  const continueNext = () => {
    setApiError(null)

    // ✅ mínimo 2 categorías
    if (categories.length < 2) {
      setContinueError("Para un torneo con categorías, crea al menos 2 categorías antes de continuar.")
      // scroll al error
      setTimeout(() => {
        topErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
        topErrorRef.current?.focus()
      }, 0)
      return
    }

    setContinueError(null)
    router.push(`/torneo/${tournamentId}/detalles`)
  }

  const formatDate = (d: string | null) => {
    if (!d) return null
    const dt = new Date(d)
    return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString()
  }

  const categoryCountLabel = useMemo(() => {
    return `${categories.length} ${categories.length === 1 ? "categoría" : "categorías"}`
  }, [categories.length])

  return (
    <div className="space-y-10">
      {/* Error global (continuar / API) */}
      {(continueError || apiError) && (
        <div
          ref={topErrorRef}
          tabIndex={-1}
          className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg"
        >
          {continueError ?? apiError}
        </div>
      )}

      {/* FORM */}
      <div className="card space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Nueva Categoría</h2>
          <p className="text-sm text-gray-500 mt-1">
            Define precio y cupo. Si lo necesitas, puedes poner fecha y ubicación distintas a las del torneo.
          </p>
        </div>

        {/* Nombre */}
        <div>
          <label className="label">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            ref={nameRef}
            className={`input ${errors.name ? "input--error" : ""}`}
            value={form.name}
            placeholder="Ej: Sub-18, Absoluto, Femenino..."
            onChange={(e) => {
              setForm({ ...form, name: e.target.value })
              clearError("name")
            }}
          />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>

        {/* Precio / Cupos */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Precio */}
          <div>
            <label className="label">
              Precio (€) <span className="text-red-500">*</span>
            </label>
            <input
              ref={priceRef}
              type="number"
              inputMode="decimal"
              className={`input no-spin ${errors.price ? "input--error" : ""}`}
              value={form.price}
              placeholder="Ej: 10 (puede ser 0)"
              onChange={(e) => {
                setForm({ ...form, price: e.target.value })
                clearError("price")
              }}
            />
            {errors.price && <p className="field-error">{errors.price}</p>}
          </div>

          {/* Min */}
          <div>
            <label className="label">
              Mín participantes <span className="text-red-500">*</span>
            </label>
            <input
              ref={minRef}
              type="number"
              inputMode="numeric"
              className={`input no-spin ${errors.min_participants ? "input--error" : ""}`}
              value={form.min_participants}
              placeholder="Ej: 1"
              onChange={(e) => {
                setForm({ ...form, min_participants: e.target.value })
                clearError("min_participants")
              }}
            />
            {errors.min_participants && <p className="field-error">{errors.min_participants}</p>}
          </div>

          {/* Max + Switch */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <label className="label">
                  Máx participantes {noMax ? "" : <span className="text-red-500">*</span>}
                </label>

                <input
                  ref={maxRef}
                  type="number"
                  inputMode="numeric"
                  disabled={noMax}
                  className={`input no-spin ${errors.max_participants ? "input--error" : ""
                    } ${noMax ? "opacity-60" : ""}`}
                  value={form.max_participants}
                  placeholder={noMax ? "Sin máximo" : "Ej: 16"}
                  onChange={(e) => {
                    setForm({ ...form, max_participants: e.target.value })
                    clearError("max_participants")
                  }}
                />

                {!noMax && errors.max_participants && (
                  <p className="field-error">{errors.max_participants}</p>
                )}
              </div>

              <div className="w-20 flex items-center justify-center self-end pb-1">
                <div className="flex flex-col items-center justify-center gap-1 text-center">
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={noMax}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setNoMax(checked)
                        clearError("max_participants")
                        if (checked) {
                          setForm((p) => ({ ...p, max_participants: "" }))
                        }
                      }}
                    />
                    <span className="slider" />
                  </label>

                  <span className="text-xs text-gray-700 leading-none text-center">
                    Sin máximo
                  </span>
                </div>
              </div>
            </div>

            {noMax && (
              <p className="text-xs text-gray-500">
                Si no pones máximo, permites inscripciones sin límite.
              </p>
            )}
          </div>
        </div>

        {/* Switches opcionales */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Fecha diferente */}
          <div className="card space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">¿Fecha diferente para esta categoría?</p>
                <p className="text-sm text-gray-500 mt-1">
                  Útil si cada categoría se juega un día distinto.
                </p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={customDate}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setCustomDate(checked)
                    if (!checked) {
                      setForm((p) => ({ ...p, start_at: "" }))
                      clearError("start_at")
                    }
                  }}
                />
                <span className="slider" />
              </label>
            </div>

            {customDate && (
              <div>
                <label className="label">Fecha</label>
                <input
                  ref={dateRef}
                  type="date"
                  className="input input-date"
                  value={form.start_at}
                  onChange={(e) => {
                    setForm({ ...form, start_at: e.target.value })
                    clearError("start_at")
                  }}
                />
              </div>
            )}
          </div>

          {/* Ubicación diferente */}
          <div className="card space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">¿Ubicación diferente para esta categoría?</p>
                <p className="text-sm text-gray-500 mt-1">
                  Útil si se juega en otra sede.
                </p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={customLocation}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setCustomLocation(checked)
                    if (!checked) {
                      setForm((p) => ({ ...p, address: "" }))
                      clearError("address")
                    }
                  }}
                />
                <span className="slider" />
              </label>
            </div>

            {customLocation && (
              <div>
                <label className="label">Dirección</label>
                <input
                  ref={addressRef}
                  className="input"
                  value={form.address}
                  placeholder="Ej: Calle Mayor 10"
                  onChange={(e) => {
                    setForm({ ...form, address: e.target.value })
                    clearError("address")
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button type="button" onClick={addCategory} disabled={loading} className="btn-primary">
            {loading ? "Añadiendo..." : "Añadir Categoría"}
          </button>
        </div>
      </div>

      {/* LIST */}
      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-lg font-semibold">Categorías creadas</h2>
            <p className="text-sm text-gray-500 mt-1">
              Estas son las opciones que verán los participantes al inscribirse.
            </p>
          </div>

          <span className="text-sm text-gray-500">{categoryCountLabel}</span>
        </div>

        {categories.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-600 text-sm">
            Aún no has creado ninguna categoría.
          </div>
        ) : (
          <div className="grid gap-4">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-6"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{cat.name}</p>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700">
                      {cat.price}€
                    </span>
                    <span className="px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700">
                      min {cat.min_participants}
                    </span>
                    <span className="px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700">
                      {cat.max_participants === null ? "sin máximo" : `max ${cat.max_participants}`}
                    </span>
                    {cat.start_at && (
                      <span className="px-2 py-1 rounded-md text-xs bg-gray-100 text-gray-700">
                        fecha {formatDate(cat.start_at)}
                      </span>
                    )}
                  </div>

                  {cat.address && (
                    <p className="text-sm text-gray-500 mt-2">{cat.address}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => deleteCategory(cat.id)}
                  disabled={deletingId === cat.id}
                  className="text-sm text-red-600 hover:text-red-700 disabled:opacity-60"
                >
                  {deletingId === cat.id ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="flex justify-end">
        <button type="button" onClick={continueNext} className="btn-primary">
          Continuar
        </button>
      </div>
    </div>
  )
}