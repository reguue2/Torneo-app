"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

type PrizeMode = "none" | "global" | "per_category"

type CategoryPrize = {
  id: string
  name: string
  prizes: string | null
}

export default function DetallesClient({
  tournamentId,
  hasCategories,
  initialPrizes,
  initialRules,
  initialPrizeMode,
  initialCategoryPrizes,
}: {
  tournamentId: string
  hasCategories: boolean
  initialPrizes: string
  initialRules: string
  initialPrizeMode: PrizeMode
  initialCategoryPrizes: CategoryPrize[]
}) {
  const supabase = createClient()
  const router = useRouter()

  const fallbackMode: PrizeMode = initialPrizes.trim() ? "global" : "none"

  const [mode, setMode] = useState<PrizeMode>(() => {
    if (!hasCategories) return fallbackMode
    if (initialPrizeMode) return initialPrizeMode
    return fallbackMode
  })

  const [prizes, setPrizes] = useState(initialPrizes)
  const [rules, setRules] = useState(initialRules)

  const [categoryPrizes, setCategoryPrizes] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const c of initialCategoryPrizes) map[c.id] = c.prizes ?? ""
    return map
  })

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const categoriesEmpty = useMemo(() => {
    if (!hasCategories || mode !== "per_category") return []
    return initialCategoryPrizes
      .filter((c) => !categoryPrizes[c.id]?.trim())
      .map((c) => c.name)
  }, [hasCategories, mode, initialCategoryPrizes, categoryPrizes])

  const canUsePerCategory = hasCategories && initialCategoryPrizes.length > 0

  const save = async () => {
    setError(null)

    const effectiveMode: PrizeMode = !hasCategories && mode === "per_category" ? fallbackMode : mode

    if (effectiveMode === "global") {
      if (!prizes.trim()) {
        setError(hasCategories ? "Escribe los premios globales o elige “Sin premios”." : "Escribe los premios o elige “Sin premios”.")
        return
      }
    }

    if (effectiveMode === "per_category") {
      if (!canUsePerCategory) {
        setError("No hay categorías para asignar premios. Crea categorías primero.")
        return
      }
      if (categoriesEmpty.length > 0) {
        setError(`Faltan premios en: ${categoriesEmpty.join(", ")}.`)
        return
      }
    }

    setLoading(true)

    const tournamentPayload: any = {
      prize_mode: effectiveMode,
      rules: rules.trim() ? rules.trim() : null,
      prizes: null as string | null,
    }

    if (effectiveMode === "global") tournamentPayload.prizes = prizes.trim()

    const { error: tErr } = await supabase
      .from("tournaments")
      .update(tournamentPayload)
      .eq("id", tournamentId)

    if (tErr) {
      setLoading(false)
      setError(tErr.message)
      return
    }

    if (effectiveMode === "per_category") {
      const updates = initialCategoryPrizes.map((c) => {
        const value = categoryPrizes[c.id]?.trim() ?? ""
        return supabase.from("categories").update({ prizes: value }).eq("id", c.id)
      })

      const results = await Promise.all(updates)
      const firstErr = results.find((r) => r.error)?.error

      if (firstErr) {
        setLoading(false)
        setError(firstErr.message)
        return
      }
    }

    setLoading(false)
    router.push(`/torneo/${tournamentId}/pagos`)
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="card space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Premios</h2>
          <p className="text-sm text-gray-500 mt-1">
            Elige si el torneo tiene premios y cómo se aplican.
          </p>
        </div>

        <div className={`grid gap-4 ${hasCategories ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <ModeCard
            title="Sin premios"
            description="No se muestran premios en la inscripción."
            selected={mode === "none"}
            onClick={() => setMode("none")}
          />

          <ModeCard
            title={hasCategories ? "Premios globales" : "Con premios"}
            description={hasCategories ? "Mismo texto para todo el torneo." : "Define el premio que se mostrará en la inscripción."}
            selected={mode === "global"}
            onClick={() => setMode("global")}
          />

          {hasCategories && (
            <ModeCard
              title="Premios por categoría"
              description={
                canUsePerCategory
                  ? "Define un premio distinto en cada categoría."
                  : "Disponible si hay categorías."
              }
              selected={mode === "per_category"}
              onClick={() => setMode("per_category")}
              disabled={!canUsePerCategory}
            />
          )}
        </div>

        {mode === "global" && (
          <div>
            <label className="label">
              Premios <span className="text-red-500">*</span>
            </label>
            <textarea
              className="textarea"
              rows={3}
              value={prizes}
              onChange={(e) => setPrizes(e.target.value)}
              placeholder="Ej: 1º 500€, 2º 300€..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Consejo: escribe algo que el participante entienda rápido (dinero, trofeo, regalos…).
            </p>
          </div>
        )}

        {hasCategories && mode === "per_category" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-medium">Premios por categoría</p>
              <p className="text-gray-600 mt-1">
                Rellena un premio para cada categoría. Esto es lo que verá la gente al apuntarse.
              </p>
            </div>

            <div className="grid gap-4">
              {initialCategoryPrizes.map((c) => {
                const value = categoryPrizes[c.id] ?? ""
                const missing = !value.trim()

                return (
                  <div key={c.id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {missing ? "Faltan premios." : "OK"}
                        </p>
                      </div>

                      <span
                        className={`text-xs px-2 py-1 rounded-md ${
                          missing ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
                        }`}
                      >
                        {missing ? "Pendiente" : "Completo"}
                      </span>
                    </div>

                    <div className="mt-3">
                      <label className="label">
                        Premios <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        className={`textarea ${missing ? "border-red-300" : ""}`}
                        rows={2}
                        value={value}
                        onChange={(e) =>
                          setCategoryPrizes((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        placeholder="Ej: 1º trofeo + 100€, 2º trofeo..."
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Reglas / Normativa</h2>
          <p className="text-sm text-gray-500 mt-1">
            Opcional, pero recomendable para evitar dudas.
          </p>
        </div>

        <textarea
          className="textarea"
          rows={7}
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          placeholder="Especifica las reglas del torneo..."
        />
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={loading} className="btn-primary">
          {loading ? "Guardando..." : "Continuar"}
        </button>
      </div>
    </div>
  )
}

function ModeCard({
  title,
  description,
  selected,
  onClick,
  disabled,
}: {
  title: string
  description: string
  selected: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left p-4 border rounded-xl transition w-full ${
        disabled
          ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
          : selected
            ? "border-indigo-600 bg-indigo-50"
            : "border-gray-300 hover:border-gray-400"
      }`}
    >
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </button>
  )
}