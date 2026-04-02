"use client"

import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import {
  createTournament,
  initialCreateTournamentState,
} from "./actions"
import { SPAIN_COMMUNITIES } from "@/lib/spain"

type StepId = "basic" | "structure" | "pricing" | "details" | "review"
type PrizeMode = "none" | "global" | "per_category"
type PaymentMethod = "cash" | "online" | "both"

type CategoryDraft = {
  id: string
  name: string
  price: string
  min_participants: string
  max_participants: string
  noMax: boolean
  start_at: string
  address: string
  prizes: string
}

type DraftState = {
  title: string
  description: string
  province: string
  address: string
  date: string
  registration_deadline: string
  is_public: boolean
  has_categories: boolean
  min_participants: string
  max_participants: string
  noMax: boolean
  entry_price: string
  payment_method: PaymentMethod
  prize_mode: PrizeMode
  prizes: string
  rules: string
  categories: CategoryDraft[]
}

type StepErrors = Record<string, string>

const STORAGE_KEY = "create-tournament-draftless-wizard-v1"

const EMPTY_CATEGORY: CategoryDraft = {
  id: "",
  name: "",
  price: "",
  min_participants: "",
  max_participants: "",
  noMax: false,
  start_at: "",
  address: "",
  prizes: "",
}

const INITIAL_DRAFT: DraftState = {
  title: "",
  description: "",
  province: "",
  address: "",
  date: "",
  registration_deadline: "",
  is_public: true,
  has_categories: true,
  min_participants: "1",
  max_participants: "",
  noMax: true,
  entry_price: "0",
  payment_method: "cash",
  prize_mode: "none",
  prizes: "",
  rules: "",
  categories: [],
}

function createCategoryId() {
  return `cat_${Math.random().toString(36).slice(2, 10)}`
}

function formatMoney(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return "—"
  if (amount === 0) return "Gratis"
  const text = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2).replace(/\.00$/, "")
  return `${text}€`
}

function formatDate(value: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function buildSerializableDraft(draft: DraftState) {
  return JSON.stringify({
    ...draft,
  })
}

function parseStoredDraft(raw: string | null): DraftState | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return {
      ...INITIAL_DRAFT,
      ...parsed,
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.map((category: CategoryDraft) => ({
          ...EMPTY_CATEGORY,
          ...category,
          id: category.id || createCategoryId(),
        }))
        : [],
    }
  } catch {
    return null
  }
}

function mapStepTitle(step: StepId) {
  if (step === "basic") return "Información básica"
  if (step === "structure") return "Estructura"
  if (step === "pricing") return "Cupos y precios"
  if (step === "details") return "Detalles y pagos"
  return "Revisión final"
}

function getVisibleSteps(hasCategories: boolean): StepId[] {
  return ["basic", "structure", "pricing", "details", "review"].filter(Boolean) as StepId[]
}

export default function CreateTournamentForm() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [serverState, formAction, pending] = useActionState(
    createTournament,
    initialCreateTournamentState
  )

  const [hydrated, setHydrated] = useState(false)
  const [draft, setDraft] = useState<DraftState>(INITIAL_DRAFT)
  const [step, setStep] = useState<StepId>("basic")
  const [errors, setErrors] = useState<StepErrors>({})
  const [posterPreview, setPosterPreview] = useState<string | null>(null)
  const [posterName, setPosterName] = useState("")
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>({
    ...EMPTY_CATEGORY,
    id: createCategoryId(),
  })
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const hydrateFromSessionStorage = async () => {
      const stored = parseStoredDraft(sessionStorage.getItem(STORAGE_KEY))

      if (cancelled) return

      if (stored) setDraft(stored)
      setHydrated(true)
    }

    void hydrateFromSessionStorage()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    sessionStorage.setItem(STORAGE_KEY, buildSerializableDraft(draft))
  }, [draft, hydrated])

  useEffect(() => {
    return () => {
      if (posterPreview) URL.revokeObjectURL(posterPreview)
    }
  }, [posterPreview])

  const steps = useMemo(() => getVisibleSteps(draft.has_categories), [draft.has_categories])
  const currentIndex = steps.indexOf(step)
  const canGoBack = currentIndex > 0
  const isLastStep = currentIndex === steps.length - 1

  const categoryTotalCapacity = useMemo(() => {
    if (!draft.has_categories) return null
    if (draft.categories.some((category) => category.noMax || !category.max_participants)) {
      return null
    }

    return draft.categories.reduce((acc, category) => {
      return acc + Number(category.max_participants || 0)
    }, 0)
  }, [draft.has_categories, draft.categories])

  const serializedCategories = useMemo(() => {
    if (!draft.has_categories) return "[]"

    return JSON.stringify(
      draft.categories.map((category) => ({
        name: category.name.trim(),
        price: Number(category.price || 0),
        min_participants: Number(category.min_participants || 0),
        max_participants: category.noMax ? null : Number(category.max_participants || 0),
        start_at: category.start_at || null,
        address: category.address.trim() || null,
        prizes: category.prizes.trim() || null,
      }))
    )
  }, [draft.has_categories, draft.categories])

  const resetCategoryDraft = () => {
    setCategoryDraft({
      ...EMPTY_CATEGORY,
      id: createCategoryId(),
    })
    setEditingCategoryId(null)
  }

  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const updateDraft = <K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setDraft((prev) => ({
      ...prev,
      [key]: value,
    }))
    clearFieldError(String(key))
  }

  const onPosterChange = (file: File | null) => {
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, poster: "El cartel debe ser una imagen válida." }))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, poster: "El cartel no puede superar los 5MB." }))
      return
    }

    clearFieldError("poster")
    setPosterName(file.name)

    if (posterPreview) URL.revokeObjectURL(posterPreview)
    setPosterPreview(URL.createObjectURL(file))
  }

  const validateBasicStep = () => {
    const next: StepErrors = {}
    const posterFile = fileInputRef.current?.files?.[0]

    if (!posterFile) {
      next.poster =
        "El cartel es obligatorio. Si recargas la página tendrás que volver a seleccionarlo."
    }

    if (!draft.title.trim()) next.title = "El título es obligatorio."
    if (!draft.province.trim()) next.province = "La provincia es obligatoria."
    if (!draft.address.trim()) next.address = "La dirección es obligatoria."
    if (!draft.date) next.date = "La fecha del torneo es obligatoria."
    if (!draft.registration_deadline) {
      next.registration_deadline = "La fecha límite de inscripción es obligatoria."
    }

    if (draft.date && draft.registration_deadline) {
      const date = new Date(draft.date)
      const deadline = new Date(draft.registration_deadline)

      if (
        !Number.isNaN(date.getTime()) &&
        !Number.isNaN(deadline.getTime()) &&
        deadline > date
      ) {
        next.registration_deadline =
          "La fecha límite no puede ser posterior a la fecha del torneo."
      }
    }

    return next
  }

  const validatePricingStep = () => {
    const next: StepErrors = {}

    if (draft.has_categories) {
      if (draft.categories.length < 2) {
        next.categories = "Debes crear al menos 2 categorías."
      }

      draft.categories.forEach((category, index) => {
        if (!category.name.trim()) {
          next[`category-${index}-name`] = "El nombre de la categoría es obligatorio."
        }

        if (category.price.trim() === "" || Number(category.price) < 0) {
          next[`category-${index}-price`] =
            "El precio de la categoría es obligatorio y no puede ser negativo."
        }

        if (
          category.min_participants.trim() === "" ||
          Number(category.min_participants) < 1
        ) {
          next[`category-${index}-min`] =
            "El mínimo de participantes de la categoría debe ser al menos 1."
        }

        if (
          !category.noMax &&
          (category.max_participants.trim() === "" ||
            Number(category.max_participants) < Number(category.min_participants || 0))
        ) {
          next[`category-${index}-max`] =
            "El máximo debe ser vacío o mayor/igual que el mínimo."
        }
      })
    } else {
      if (draft.min_participants.trim() === "" || Number(draft.min_participants) < 1) {
        next.min_participants = "El mínimo de participantes debe ser al menos 1."
      }

      if (
        !draft.noMax &&
        (draft.max_participants.trim() === "" ||
          Number(draft.max_participants) < Number(draft.min_participants || 0))
      ) {
        next.max_participants = "El máximo debe ser vacío o mayor/igual que el mínimo."
      }

      if (draft.entry_price.trim() === "" || Number(draft.entry_price) < 0) {
        next.entry_price = "El precio del torneo no puede ser negativo."
      }
    }

    return next
  }

  const validateDetailsStep = () => {
    const next: StepErrors = {}

    if (!draft.payment_method) {
      next.payment_method = "Debes elegir un método de pago."
    }

    if (draft.prize_mode === "global" && !draft.prizes.trim()) {
      next.prizes = "Si eliges premios globales, debes rellenarlos."
    }

    if (draft.prize_mode === "per_category" && !draft.has_categories) {
      next.prize_mode = "Los premios por categoría requieren un torneo con categorías."
    }

    if (draft.prize_mode === "per_category") {
      const categoryWithoutPrize = draft.categories.find((category) => !category.prizes.trim())
      if (categoryWithoutPrize) {
        next.category_prizes = `Faltan premios en la categoría ${categoryWithoutPrize.name}.`
      }
    }

    return next
  }

  const validateCurrentStep = () => {
    if (step === "basic") return validateBasicStep()
    if (step === "pricing") return validatePricingStep()
    if (step === "details") return validateDetailsStep()
    return {}
  }

  const goNext = () => {
    const nextErrors = validateCurrentStep()
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) return

    if (isLastStep) return

    setStep(steps[currentIndex + 1])
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const goBack = () => {
    if (!canGoBack) return
    setStep(steps[currentIndex - 1])
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const saveCategory = () => {
    const next: StepErrors = {}

    if (!categoryDraft.name.trim()) next.category_name = "El nombre es obligatorio."
    if (categoryDraft.price.trim() === "" || Number(categoryDraft.price) < 0) {
      next.category_price = "El precio es obligatorio y no puede ser negativo."
    }
    if (
      categoryDraft.min_participants.trim() === "" ||
      Number(categoryDraft.min_participants) < 1
    ) {
      next.category_min = "El mínimo debe ser al menos 1."
    }
    if (
      !categoryDraft.noMax &&
      (categoryDraft.max_participants.trim() === "" ||
        Number(categoryDraft.max_participants) <
        Number(categoryDraft.min_participants || 0))
    ) {
      next.category_max = "El máximo debe ser vacío o mayor/igual que el mínimo."
    }

    if (Object.keys(next).length > 0) {
      setErrors((prev) => ({ ...prev, ...next }))
      return
    }

    setDraft((prev) => {
      const nextCategory: CategoryDraft = {
        ...categoryDraft,
        name: categoryDraft.name.trim(),
        address: categoryDraft.address.trim(),
        prizes: categoryDraft.prizes.trim(),
      }

      if (editingCategoryId) {
        return {
          ...prev,
          categories: prev.categories.map((category) =>
            category.id === editingCategoryId ? nextCategory : category
          ),
        }
      }

      return {
        ...prev,
        categories: [...prev.categories, nextCategory],
      }
    })

    setErrors((prev) => {
      const nextErrors = { ...prev }
      delete nextErrors.category_name
      delete nextErrors.category_price
      delete nextErrors.category_min
      delete nextErrors.category_max
      delete nextErrors.categories
      delete nextErrors.category_prizes
      return nextErrors
    })

    resetCategoryDraft()
  }

  const editCategory = (id: string) => {
    const found = draft.categories.find((category) => category.id === id)
    if (!found) return
    setCategoryDraft(found)
    setEditingCategoryId(id)
    setStep("pricing")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const removeCategory = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      categories: prev.categories.filter((category) => category.id !== id),
    }))

    if (editingCategoryId === id) {
      resetCategoryDraft()
    }
  }

  const resetLocalDraft = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setDraft(INITIAL_DRAFT)
    setPosterPreview(null)
    setPosterName("")
    setErrors({})
    setStep("basic")
    resetCategoryDraft()

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-600">Nuevo torneo</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
              Crear y publicar torneo
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-500">
              Flujo nuevo sin drafts persistidos en base de datos. Todo se prepara aquí y se publica al final.
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-gray-400">Paso actual</p>
            <p className="text-lg font-semibold text-gray-900">{mapStepTitle(step)}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          {steps.map((stepId, index) => {
            const active = stepId === step
            const completed = index < currentIndex

            return (
              <div
                key={stepId}
                className={`rounded-2xl border px-4 py-3 text-sm ${active
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : completed
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-gray-200 bg-gray-50 text-gray-500"
                  }`}
              >
                <div className="font-medium">{index + 1}. {mapStepTitle(stepId)}</div>
              </div>
            )
          })}
        </div>
      </div>

      {serverState.error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {serverState.error}
        </div>
      )}

      <form action={formAction} className="space-y-8">
        <input type="hidden" name="is_public" value={String(draft.is_public)} />
        <input type="hidden" name="has_categories" value={String(draft.has_categories)} />
        <input type="hidden" name="payment_method" value={draft.payment_method} />
        <input type="hidden" name="prize_mode" value={draft.prize_mode} />
        <input
          type="hidden"
          name="min_participants"
          value={draft.has_categories ? draft.min_participants : draft.min_participants}
        />
        <input
          type="hidden"
          name="max_participants"
          value={draft.noMax ? "" : draft.max_participants}
        />
        <input type="hidden" name="entry_price" value={draft.entry_price} />
        <input type="hidden" name="categories_json" value={serializedCategories} />

        {step === "basic" && (
          <section className="card space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Información básica</h2>
              <p className="mt-1 text-sm text-gray-500">
                Define la identidad pública del torneo.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <div>
                  <label className="label">Título del torneo</label>
                  <input
                    name="title"
                    className="input"
                    value={draft.title}
                    onChange={(e) => updateDraft("title", e.target.value)}
                    placeholder="Ej. Torneo de Pádel Ciudad de Logroño"
                  />
                  {errors.title && <p className="error-text">{errors.title}</p>}
                </div>

                <div>
                  <label className="label">Descripción</label>
                  <textarea
                    name="description"
                    className="textarea min-h-28"
                    value={draft.description}
                    onChange={(e) => updateDraft("description", e.target.value)}
                    placeholder="Resumen del torneo, formato, ambiente, público objetivo..."
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="label">Provincia</label>
                    <select
                      name="province"
                      className="input"
                      value={draft.province}
                      onChange={(e) => updateDraft("province", e.target.value)}
                    >
                      <option value="">Selecciona una provincia</option>
                      {SPAIN_COMMUNITIES.map((province) => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))}
                    </select>
                    {errors.province && <p className="error-text">{errors.province}</p>}
                  </div>

                  <div>
                    <label className="label">Dirección</label>
                    <input
                      name="address"
                      className="input"
                      value={draft.address}
                      onChange={(e) => updateDraft("address", e.target.value)}
                      placeholder="Instalación o dirección exacta"
                    />
                    {errors.address && <p className="error-text">{errors.address}</p>}
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="label">Fecha del torneo</label>
                    <input
                      name="date"
                      type="datetime-local"
                      className="input"
                      value={draft.date}
                      onChange={(e) => updateDraft("date", e.target.value)}
                    />
                    {errors.date && <p className="error-text">{errors.date}</p>}
                  </div>

                  <div>
                    <label className="label">Fecha límite de inscripción</label>
                    <input
                      name="registration_deadline"
                      type="datetime-local"
                      className="input"
                      value={draft.registration_deadline}
                      onChange={(e) => updateDraft("registration_deadline", e.target.value)}
                    />
                    {errors.registration_deadline && (
                      <p className="error-text">{errors.registration_deadline}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <p className="font-medium text-gray-900">Visibilidad pública</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Si está activo, el torneo aparecerá en explorar.
                    </p>
                  </div>

                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={draft.is_public}
                      onChange={(e) => updateDraft("is_public", e.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900">Cartel del torneo</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Obligatorio. JPG, PNG o similar. Máximo 5MB.
                  </p>

                  <div className="mt-4 space-y-4">
                    <input
                      ref={fileInputRef}
                      name="poster"
                      type="file"
                      accept="image/*"
                      onChange={(e) => onPosterChange(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                    />

                    {posterName && (
                      <p className="text-sm text-gray-600">Archivo seleccionado: {posterName}</p>
                    )}

                    {posterPreview && (
                      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                        <img
                          src={posterPreview}
                          alt="Vista previa del cartel"
                          className="h-64 w-full object-contain"
                        />
                      </div>
                    )}

                    {errors.poster && <p className="error-text">{errors.poster}</p>}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900">Resumen</h3>
                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                    <p>
                      <span className="font-medium text-gray-900">Título:</span>{" "}
                      {draft.title || "—"}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Provincia:</span>{" "}
                      {draft.province || "—"}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Dirección:</span>{" "}
                      {draft.address || "—"}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Fecha:</span>{" "}
                      {formatDate(draft.date)}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Límite inscripción:</span>{" "}
                      {formatDate(draft.registration_deadline)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {step === "structure" && (
          <section className="card space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Estructura</h2>
              <p className="mt-1 text-sm text-gray-500">
                Decide si el torneo funciona con categorías o con una inscripción general.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => updateDraft("has_categories", true)}
                className={`rounded-2xl border p-5 text-left transition ${draft.has_categories
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
              >
                <p className="text-lg font-semibold text-gray-900">Con categorías</p>
                <p className="mt-2 text-sm text-gray-500">
                  Precio, cupos y premios pueden depender de cada categoría.
                </p>
              </button>

              <button
                type="button"
                onClick={() => updateDraft("has_categories", false)}
                className={`rounded-2xl border p-5 text-left transition ${!draft.has_categories
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
              >
                <p className="text-lg font-semibold text-gray-900">Sin categorías</p>
                <p className="mt-2 text-sm text-gray-500">
                  Todo el torneo comparte un único precio y una única bolsa de cupos.
                </p>
              </button>
            </div>
          </section>
        )}

        {step === "pricing" && (
          <section className="card space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Cupos y precios</h2>
              <p className="mt-1 text-sm text-gray-500">
                Configura capacidad y precio del torneo o de cada categoría.
              </p>
            </div>

            {draft.has_categories ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-4">
                  {draft.categories.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
                      Todavía no has añadido categorías.
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {draft.categories.map((category) => (
                        <div
                          key={category.id}
                          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">
                                {category.name}
                              </h3>
                              <div className="mt-2 space-y-1 text-sm text-gray-600">
                                <p>Precio: {formatMoney(category.price)}</p>
                                <p>Mínimo: {category.min_participants}</p>
                                <p>
                                  Máximo: {category.noMax ? "Sin máximo" : category.max_participants}
                                </p>
                                {category.address && <p>Dirección: {category.address}</p>}
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => editCategory(category.id)}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => removeCategory(category.id)}
                                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {errors.categories && <p className="error-text">{errors.categories}</p>}
                  {errors.category_prizes && <p className="error-text">{errors.category_prizes}</p>}

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    <p>
                      <span className="font-medium text-gray-900">Capacidad total visible:</span>{" "}
                      {categoryTotalCapacity === null ? "Sin máximo" : `${categoryTotalCapacity} plazas`}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingCategoryId ? "Editar categoría" : "Nueva categoría"}
                  </h3>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="label">Nombre</label>
                      <input
                        className="input"
                        value={categoryDraft.name}
                        onChange={(e) =>
                          setCategoryDraft((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                      {errors.category_name && <p className="error-text">{errors.category_name}</p>}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="label">Precio</label>
                        <input
                          className="input"
                          inputMode="decimal"
                          value={categoryDraft.price}
                          onChange={(e) =>
                            setCategoryDraft((prev) => ({ ...prev, price: e.target.value }))
                          }
                        />
                        {errors.category_price && <p className="error-text">{errors.category_price}</p>}
                      </div>

                      <div>
                        <label className="label">Mínimo participantes</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={categoryDraft.min_participants}
                          onChange={(e) =>
                            setCategoryDraft((prev) => ({
                              ...prev,
                              min_participants: e.target.value,
                            }))
                          }
                        />
                        {errors.category_min && <p className="error-text">{errors.category_min}</p>}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label className="label">Máximo participantes</label>
                        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={categoryDraft.noMax}
                            onChange={(e) =>
                              setCategoryDraft((prev) => ({
                                ...prev,
                                noMax: e.target.checked,
                                max_participants: e.target.checked ? "" : prev.max_participants,
                              }))
                            }
                          />
                          Sin máximo
                        </label>
                      </div>

                      <input
                        className="input"
                        inputMode="numeric"
                        value={categoryDraft.max_participants}
                        disabled={categoryDraft.noMax}
                        onChange={(e) =>
                          setCategoryDraft((prev) => ({
                            ...prev,
                            max_participants: e.target.value,
                          }))
                        }
                      />
                      {errors.category_max && <p className="error-text">{errors.category_max}</p>}
                    </div>

                    <div>
                      <label className="label">Hora / fecha de inicio (opcional)</label>
                      <input
                        type="datetime-local"
                        className="input"
                        value={categoryDraft.start_at}
                        onChange={(e) =>
                          setCategoryDraft((prev) => ({ ...prev, start_at: e.target.value }))
                        }
                      />
                    </div>

                    <div>
                      <label className="label">Ubicación específica (opcional)</label>
                      <input
                        className="input"
                        value={categoryDraft.address}
                        onChange={(e) =>
                          setCategoryDraft((prev) => ({ ...prev, address: e.target.value }))
                        }
                      />
                    </div>

                    <div>
                      <label className="label">Premios por categoría (opcional)</label>
                      <textarea
                        className="textarea min-h-24"
                        value={categoryDraft.prizes}
                        onChange={(e) =>
                          setCategoryDraft((prev) => ({ ...prev, prizes: e.target.value }))
                        }
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={saveCategory}
                        className="btn-primary"
                      >
                        {editingCategoryId ? "Guardar categoría" : "Añadir categoría"}
                      </button>

                      {editingCategoryId && (
                        <button
                          type="button"
                          onClick={resetCategoryDraft}
                          className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          Cancelar edición
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <label className="label">Mínimo participantes</label>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={draft.min_participants}
                    onChange={(e) => updateDraft("min_participants", e.target.value)}
                  />
                  {errors.min_participants && <p className="error-text">{errors.min_participants}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="label">Máximo participantes</label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={draft.noMax}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            noMax: e.target.checked,
                            max_participants: e.target.checked ? "" : prev.max_participants,
                          }))
                        }
                      />
                      Sin máximo
                    </label>
                  </div>

                  <input
                    className="input"
                    inputMode="numeric"
                    disabled={draft.noMax}
                    value={draft.max_participants}
                    onChange={(e) => updateDraft("max_participants", e.target.value)}
                  />
                  {errors.max_participants && <p className="error-text">{errors.max_participants}</p>}
                </div>

                <div>
                  <label className="label">Precio de inscripción</label>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={draft.entry_price}
                    onChange={(e) => updateDraft("entry_price", e.target.value)}
                  />
                  {errors.entry_price && <p className="error-text">{errors.entry_price}</p>}
                </div>
              </div>
            )}
          </section>
        )}

        {step === "details" && (
          <section className="card space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Detalles y pagos</h2>
              <p className="mt-1 text-sm text-gray-500">
                Configura método de pago, premios y normativa.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <div>
                  <label className="label">Método de pago</label>
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      { value: "cash", label: "Solo efectivo" },
                      { value: "online", label: "Solo online" },
                      { value: "both", label: "Ambos" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateDraft("payment_method", option.value as PaymentMethod)}
                        className={`rounded-2xl border p-4 text-left transition ${draft.payment_method === option.value
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                            : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                      >
                        <p className="font-medium">{option.label}</p>
                      </button>
                    ))}
                  </div>
                  {errors.payment_method && <p className="error-text">{errors.payment_method}</p>}
                </div>

                <div>
                  <label className="label">Modelo de premios</label>
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      { value: "none", label: "Sin premios" },
                      { value: "global", label: "Premios globales" },
                      {
                        value: "per_category",
                        label: "Premios por categoría",
                      },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateDraft("prize_mode", option.value as PrizeMode)}
                        className={`rounded-2xl border p-4 text-left transition ${draft.prize_mode === option.value
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                            : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                      >
                        <p className="font-medium">{option.label}</p>
                      </button>
                    ))}
                  </div>
                  {errors.prize_mode && <p className="error-text">{errors.prize_mode}</p>}
                </div>

                {draft.prize_mode === "global" && (
                  <div>
                    <label className="label">Premios globales</label>
                    <textarea
                      name="prizes"
                      className="textarea min-h-28"
                      value={draft.prizes}
                      onChange={(e) => updateDraft("prizes", e.target.value)}
                      placeholder="1º 300€ + trofeo, 2º 150€, etc."
                    />
                    {errors.prizes && <p className="error-text">{errors.prizes}</p>}
                  </div>
                )}

                <div>
                  <label className="label">Reglas / normativa</label>
                  <textarea
                    name="rules"
                    className="textarea min-h-40"
                    value={draft.rules}
                    onChange={(e) => updateDraft("rules", e.target.value)}
                    placeholder="Formato, normativa, requisitos, desempates, comportamiento..."
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">Contexto de producto</h3>
                <div className="mt-4 space-y-3 text-sm text-gray-600">
                  <p>
                    La inscripción pública entra primero por validación de email.
                  </p>
                  <p>
                    El efectivo requiere validación manual del organizador.
                  </p>
                  <p>
                    El online sigue visible en producto, aunque durante desarrollo esté simulado.
                  </p>
                  <p>
                    Si el torneo tiene categorías, ellas mandan en precio y cupos.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {step === "review" && (
          <section className="card space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Revisión final</h2>
              <p className="mt-1 text-sm text-gray-500">
                Última comprobación antes de crear y publicar.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <h3 className="text-lg font-semibold text-gray-900">Resumen general</h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm text-gray-600">
                    <p><span className="font-medium text-gray-900">Título:</span> {draft.title || "—"}</p>
                    <p><span className="font-medium text-gray-900">Provincia:</span> {draft.province || "—"}</p>
                    <p><span className="font-medium text-gray-900">Dirección:</span> {draft.address || "—"}</p>
                    <p><span className="font-medium text-gray-900">Fecha:</span> {formatDate(draft.date)}</p>
                    <p>
                      <span className="font-medium text-gray-900">Límite inscripción:</span>{" "}
                      {formatDate(draft.registration_deadline)}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Visibilidad:</span>{" "}
                      {draft.is_public ? "Público" : "Oculto del explorador"}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Estructura:</span>{" "}
                      {draft.has_categories ? "Con categorías" : "Sin categorías"}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Pago:</span>{" "}
                      {draft.payment_method === "cash"
                        ? "Solo efectivo"
                        : draft.payment_method === "online"
                          ? "Solo online"
                          : "Efectivo y online"}
                    </p>
                  </div>
                </div>

                {draft.has_categories ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <h3 className="text-lg font-semibold text-gray-900">Categorías</h3>
                    <div className="mt-4 grid gap-4">
                      {draft.categories.map((category) => (
                        <div key={category.id} className="rounded-xl border border-gray-200 bg-white p-4">
                          <p className="font-medium text-gray-900">{category.name}</p>
                          <div className="mt-2 space-y-1 text-sm text-gray-600">
                            <p>Precio: {formatMoney(category.price)}</p>
                            <p>Mínimo: {category.min_participants}</p>
                            <p>Máximo: {category.noMax ? "Sin máximo" : category.max_participants}</p>
                            <p>Premios: {category.prizes || "—"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <h3 className="text-lg font-semibold text-gray-900">Inscripción general</h3>
                    <div className="mt-4 space-y-2 text-sm text-gray-600">
                      <p>Precio: {formatMoney(draft.entry_price)}</p>
                      <p>Mínimo: {draft.min_participants}</p>
                      <p>Máximo: {draft.noMax ? "Sin máximo" : draft.max_participants}</p>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <h3 className="text-lg font-semibold text-gray-900">Reglas y premios</h3>
                  <div className="mt-4 space-y-3 text-sm text-gray-600">
                    <p>
                      <span className="font-medium text-gray-900">Modelo premios:</span>{" "}
                      {draft.prize_mode === "none"
                        ? "Sin premios"
                        : draft.prize_mode === "global"
                          ? "Globales"
                          : "Por categoría"}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Premios globales:</span>{" "}
                      {draft.prizes || "—"}
                    </p>
                    <p className="whitespace-pre-wrap">
                      <span className="font-medium text-gray-900">Normativa:</span>{" "}
                      {draft.rules || "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">Antes de publicar</h3>
                <div className="mt-4 space-y-3 text-sm text-gray-600">
                  <p>Se subirá el cartel a storage.</p>
                  <p>Se creará el torneo directamente en la BD.</p>
                  <p>No se persistirá ningún draft como flujo normal.</p>
                  <p>El torneo quedará publicado al terminar.</p>
                </div>

                <button
                  type="submit"
                  disabled={pending || !hydrated}
                  className="btn-primary mt-6 w-full"
                >
                  {pending ? "Creando torneo..." : "Crear y publicar torneo"}
                </button>

                <button
                  type="button"
                  onClick={resetLocalDraft}
                  className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Reiniciar formulario
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={!canGoBack}
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Volver
            </button>

            {!isLastStep && (
              <button
                type="button"
                onClick={goNext}
                className="btn-primary"
              >
                Continuar
              </button>
            )}
          </div>

          <p className="text-sm text-gray-500">
            {hydrated
              ? "El progreso se guarda en sesión del navegador."
              : "Preparando formulario..."}
          </p>
        </div>
      </form>
    </div>
  )
}