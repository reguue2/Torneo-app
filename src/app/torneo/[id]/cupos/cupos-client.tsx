"use client"

import { useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

type Field = "entry_price" | "min_participants" | "max_participants"
type FieldErrors = Partial<Record<Field, string>>

export default function CuposClient({
    tournamentId,
    initialMin,
    initialMax,
    initialPrice,
}: {
    tournamentId: string
    initialMin: number | null
    initialMax: number | null
    initialPrice: number
}) {
    const supabase = createClient()
    const router = useRouter()

    const priceRef = useRef<HTMLInputElement | null>(null)
    const minRef = useRef<HTMLInputElement | null>(null)
    const maxRef = useRef<HTMLInputElement | null>(null)

    // strings para permitir vacío (NO inicializar)
    const [price, setPrice] = useState<string>("")
    const [minParticipants, setMinParticipants] = useState<string>("")
    const [maxParticipants, setMaxParticipants] = useState<string>(
        initialMax === null ? "" : String(initialMax)
    )

    const [noMax, setNoMax] = useState<boolean>(initialMax === null)

    const [errors, setErrors] = useState<FieldErrors>({})
    const [apiError, setApiError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

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

        // Precio obligatorio (0 permitido)
        if (price.trim() === "") {
            next.entry_price = "El precio es obligatorio (puede ser 0)."
        } else {
            const p = Number(price)
            if (!Number.isFinite(p) || p < 0) next.entry_price = "Introduce un precio válido (>= 0)."
        }

        // Min obligatorio
        if (minParticipants.trim() === "") {
            next.min_participants = "El mínimo es obligatorio."
        } else {
            const min = Number(minParticipants)
            if (!Number.isFinite(min) || min < 1) next.min_participants = "El mínimo debe ser al menos 1."
        }

        // Max obligatorio salvo sin máximo
        if (!noMax) {
            if (maxParticipants.trim() === "") {
                next.max_participants = "El máximo es obligatorio o marca “Sin máximo”."
            } else {
                const max = Number(maxParticipants)
                const min = Number(minParticipants)
                if (!Number.isFinite(max) || max < 1) {
                    next.max_participants = "Introduce un máximo válido (>= 1) o marca “Sin máximo”."
                } else if (Number.isFinite(min) && max < min) {
                    next.max_participants = "El máximo no puede ser menor que el mínimo."
                }
            }
        }

        return next
    }

    const focusFirstError = (next: FieldErrors) => {
        const order: Field[] = ["entry_price", "min_participants", "max_participants"]
        const first = order.find((k) => next[k])
        if (!first) return

        const map: Record<Field, HTMLElement | null> = {
            entry_price: priceRef.current,
            min_participants: minRef.current,
            max_participants: maxRef.current,
        }

        const el = map[first]
        el?.focus()
        el?.scrollIntoView({ behavior: "smooth", block: "center" })
    }

    const save = async () => {
        setApiError(null)

        const next = validate()
        setErrors(next)

        if (Object.keys(next).length > 0) {
            focusFirstError(next)
            return
        }

        const entry_price = Number(price)
        const min = Number(minParticipants)
        const max = noMax ? null : Number(maxParticipants)

        setLoading(true)

        const payload = {
            entry_price,
            min_participants: min,
            max_participants: max,
        }

        const { error } = await supabase
            .from("tournaments")
            .update(payload)
            .eq("id", tournamentId)

        setLoading(false)

        if (error) {
            setApiError(error.message)
            return
        }

        router.push(`/torneo/${tournamentId}/detalles`)
    }

    return (
        <div className="space-y-8">
            {apiError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg">
                    {apiError}
                </div>
            )}

            <div className="card space-y-6">
                <div>
                    <h2 className="text-lg font-semibold">Cupos y precio</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Este torneo no tiene categorías, así que el precio será el mismo para todos.
                    </p>
                </div>

                {/* ===== Layout copiado de CategoriesManager ===== */}
                <div className="grid md:grid-cols-3 gap-6">
                    {/* Precio */}
                    <div>
                        <div className="h-10 flex items-center">
                            <label className="label mb-0 whitespace-nowrap">
                                Precio (€) <span className="text-red-500">*</span>
                            </label>
                        </div>

                        <input
                            ref={priceRef}
                            type="number"
                            inputMode="decimal"
                            className={`input no-spin ${errors.entry_price ? "input--error" : ""}`}
                            value={price}
                            placeholder="Ej: 10 (puede ser 0)"
                            onChange={(e) => {
                                setPrice(e.target.value)
                                clearError("entry_price")
                            }}
                        />

                        {errors.entry_price ? (
                            <p className="field-error">{errors.entry_price}</p>
                        ) : (
                            <p className="text-xs text-gray-500 mt-1">Si el torneo es gratuito, pon 0.</p>
                        )}
                    </div>

                    {/* Min */}
                    <div>
                        <div className="h-10 flex items-center">
                            <label className="label mb-0 whitespace-nowrap">
                                Mín participantes <span className="text-red-500">*</span>
                            </label>
                        </div>

                        <input
                            ref={minRef}
                            type="number"
                            inputMode="numeric"
                            className={`input no-spin ${errors.min_participants ? "input--error" : ""}`}
                            value={minParticipants}
                            placeholder="Ej: 1"
                            onChange={(e) => {
                                setMinParticipants(e.target.value)
                                clearError("min_participants")
                            }}
                        />

                        {errors.min_participants ? (
                            <p className="field-error">{errors.min_participants}</p>
                        ) : (
                            <p className="text-xs text-gray-500 mt-1">Sirve para planificar.</p>
                        )}
                    </div>

                    {/* Max */}
                    <div>
                        <div className="h-10 flex items-center">
                            <label className="label mb-0 whitespace-nowrap">
                                Máx participantes {noMax ? "" : <span className="text-red-500">*</span>}
                            </label>
                        </div>

                        {/* grid interno para que el input tenga el MISMO tamaño visual */}
                        <div className="grid grid-cols-[1fr_80px] gap-4 items-center">
                            <input
                                ref={maxRef}
                                type="number"
                                inputMode="numeric"
                                disabled={noMax}
                                className={`input no-spin ${errors.max_participants ? "input--error" : ""} ${noMax ? "opacity-60" : ""
                                    }`}
                                value={maxParticipants}
                                placeholder={noMax ? "Sin máximo" : "Ej: 32"}
                                onChange={(e) => {
                                    setMaxParticipants(e.target.value)
                                    clearError("max_participants")
                                }}
                            />

                            <div className="w-[80px] flex flex-col items-center justify-center">
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={noMax}
                                        onChange={(e) => {
                                            const checked = e.target.checked
                                            setNoMax(checked)
                                            clearError("max_participants")
                                            if (checked) setMaxParticipants("")
                                        }}
                                    />
                                    <span className="slider" />
                                </label>
                                <span className="text-xs text-gray-700 leading-none mt-1 text-center">
                                    Sin máximo
                                </span>
                            </div>
                        </div>

                        {!noMax && errors.max_participants && (
                            <p className="field-error">{errors.max_participants}</p>
                        )}

                        {noMax && (
                            <p className="text-xs text-gray-500 mt-2">
                                Si no pones máximo, permites inscripciones sin límite (tú gestionas el cuadro después).
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button onClick={save} disabled={loading} className="btn-primary">
                    {loading ? "Guardando..." : "Continuar"}
                </button>
            </div>
        </div>
    )
}