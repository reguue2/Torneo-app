"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { v4 as uuidv4 } from "uuid"
import { z } from "zod"
import type { Database } from "@/types/database"

export type CreateTournamentActionState = {
  error: string | null
}

const CategorySchema = z
  .object({
    name: z.string().trim().min(1, "El nombre de la categoría es obligatorio."),
    participant_type: z.enum(["individual", "team"]),
    price: z.coerce.number().min(0, "El precio de la categoría no puede ser negativo."),
    min_participants: z.coerce
      .number()
      .int()
      .min(1, "El mínimo de inscripciones de la categoría debe ser al menos 1."),
    max_participants: z.union([z.coerce.number().int().min(1), z.null()]),
    start_at: z.string().nullable(),
    address: z.string().nullable(),
    prizes: z.string().nullable(),
  })
  .superRefine((value, ctx) => {
    if (
      value.max_participants !== null &&
      value.max_participants < value.min_participants
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "El máximo de inscripciones de la categoría no puede ser menor que el mínimo.",
        path: ["max_participants"],
      })
    }
  })

type CreateAndPublishTournamentRpcArgs = Omit<
  Database["public"]["Functions"]["create_and_publish_tournament"]["Args"],
  | "p_description"
  | "p_prizes"
  | "p_rules"
  | "p_max_participants"
  | "p_categories"
  | "p_participant_type"
> & {
  p_description: string | null
  p_prizes: string | null
  p_rules: string | null
  p_max_participants: number | null
  p_participant_type: "individual" | "team" | null
  p_categories: z.infer<typeof CategorySchema>[]
}

function parseBoolean(value: FormDataEntryValue | null) {
  return value === "true"
}

function parseParticipantType(value: FormDataEntryValue | null) {
  if (value === "individual" || value === "team") return value
  return null
}

function parseNullableInteger(value: FormDataEntryValue | null): number | null {
  const text = typeof value === "string" ? value.trim() : ""
  if (!text) return null

  const parsed = Number(text)
  if (!Number.isInteger(parsed)) return Number.NaN

  return parsed
}

function parseCategories(raw: string) {
  try {
    const parsed = JSON.parse(raw)
    return z.array(CategorySchema).parse(parsed)
  } catch {
    throw new Error("Las categorías no tienen un formato válido.")
  }
}

export async function createTournament(
  _prevState: CreateTournamentActionState,
  formData: FormData
): Promise<CreateTournamentActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Debes iniciar sesión para crear un torneo." }
  }

  const file = formData.get("poster") as File | null

  if (!file || file.size === 0) {
    return { error: "El cartel es obligatorio." }
  }

  if (!file.type.startsWith("image/")) {
    return { error: "El cartel debe ser una imagen válida." }
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: "El cartel no puede superar los 5MB." }
  }

  const title = (formData.get("title") as string | null)?.trim() ?? ""
  const description = (formData.get("description") as string | null)?.trim() ?? ""
  const province = (formData.get("province") as string | null)?.trim() ?? ""
  const address = (formData.get("address") as string | null)?.trim() ?? ""
  const date = (formData.get("date") as string | null)?.trim() ?? ""
  const registrationDeadline =
    (formData.get("registration_deadline") as string | null)?.trim() ?? ""
  const isPublic = parseBoolean(formData.get("is_public"))
  const hasCategories = parseBoolean(formData.get("has_categories"))
  const participantType = parseParticipantType(formData.get("participant_type"))
  const minParticipants = parseNullableInteger(formData.get("min_participants"))
  const maxParticipants = parseNullableInteger(formData.get("max_participants"))
  const paymentMethod =
    (formData.get("payment_method") as "cash" | "online" | "both" | null) ?? null
  const prizeMode =
    (formData.get("prize_mode") as "none" | "global" | "per_category" | null) ??
    "none"
  const prizes = (formData.get("prizes") as string | null)?.trim() ?? ""
  const rules = (formData.get("rules") as string | null)?.trim() ?? ""
  const entryPriceRaw = (formData.get("entry_price") as string | null)?.trim() ?? ""
  const categoriesRaw =
    (formData.get("categories_json") as string | null)?.trim() ?? "[]"

  if (!title) return { error: "El título es obligatorio." }
  if (!province) return { error: "La provincia es obligatoria." }
  if (!address) return { error: "La dirección es obligatoria." }
  if (!date) return { error: "La fecha del torneo es obligatoria." }
  if (!registrationDeadline) {
    return { error: "La fecha límite de inscripción es obligatoria." }
  }

  const dateValue = new Date(date)
  const deadlineValue = new Date(registrationDeadline)

  if (Number.isNaN(dateValue.getTime())) {
    return { error: "La fecha del torneo no es válida." }
  }

  if (Number.isNaN(deadlineValue.getTime())) {
    return { error: "La fecha límite de inscripción no es válida." }
  }

  if (deadlineValue > dateValue) {
    return { error: "La fecha límite no puede ser posterior al torneo." }
  }

  if (!paymentMethod) {
    return { error: "Debes elegir un método de pago." }
  }

  if (
    minParticipants === null ||
    !Number.isInteger(minParticipants) ||
    minParticipants <= 0
  ) {
    return { error: "El mínimo de inscripciones del torneo no es válido." }
  }

  const validatedMinParticipants: number = minParticipants

  if (
    maxParticipants !== null &&
    (!Number.isInteger(maxParticipants) ||
      maxParticipants < validatedMinParticipants)
  ) {
    return { error: "El máximo de inscripciones del torneo no es válido." }
  }

  let entryPrice = Number(entryPriceRaw || "0")
  if (!Number.isFinite(entryPrice) || entryPrice < 0) {
    return { error: "El precio del torneo no es válido." }
  }

  let categories: z.infer<typeof CategorySchema>[] = []

  if (hasCategories) {
    try {
      categories = parseCategories(categoriesRaw)
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Las categorías no tienen un formato válido.",
      }
    }

    if (categories.length < 2) {
      return { error: "Debes crear al menos 2 categorías." }
    }

    entryPrice = 0

    if (prizeMode === "per_category") {
      const emptyPrizeCategory = categories.find(
        (category) => !category.prizes?.trim()
      )
      if (emptyPrizeCategory) {
        return {
          error: `Faltan los premios en la categoría “${emptyPrizeCategory.name}”.`,
        }
      }
    }
  } else {
    if (!participantType) {
      return {
        error:
          "Debes indicar si el torneo se inscribe de forma individual o por equipos.",
      }
    }

    if (!Number.isFinite(entryPrice) || entryPrice < 0) {
      return { error: "El precio del torneo no es válido." }
    }

    if (prizeMode === "per_category") {
      return {
        error:
          "Los premios por categoría solo son válidos si el torneo tiene categorías.",
      }
    }
  }

  if (prizeMode === "global" && !prizes.trim()) {
    return {
      error: "Has elegido premios globales, pero no los has rellenado.",
    }
  }

  const fileExt = file.name.split(".").pop() ?? "jpg"
  const fileName = `${user.id}-${uuidv4()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from("tournament-posters")
    .upload(fileName, file)

  if (uploadError) {
    return { error: "No se pudo subir el cartel del torneo." }
  }

  const { data: publicUrlData } = supabase.storage
    .from("tournament-posters")
    .getPublicUrl(fileName)

  const posterUrl = publicUrlData.publicUrl

  const rpcArgs: CreateAndPublishTournamentRpcArgs = {
    p_title: title,
    p_description: description || null,
    p_poster_url: posterUrl,
    p_province: province,
    p_address: address,
    p_date: date,
    p_registration_deadline: registrationDeadline,
    p_is_public: isPublic,
    p_has_categories: hasCategories,
    p_participant_type: hasCategories ? null : participantType,
    p_min_participants: validatedMinParticipants,
    p_max_participants: maxParticipants,
    p_payment_method: paymentMethod,
    p_prize_mode: prizeMode,
    p_prizes: prizes || null,
    p_rules: rules || null,
    p_entry_price: entryPrice,
    p_categories: categories,
  }

  const { data, error: rpcError } = await supabase.rpc(
    "create_and_publish_tournament",
    rpcArgs as unknown as Database["public"]["Functions"]["create_and_publish_tournament"]["Args"]
  )

  if (rpcError) {
    await supabase.storage.from("tournament-posters").remove([fileName])
    return { error: rpcError.message }
  }

  const tournamentId = typeof data === "string" ? data : null

  if (!tournamentId) {
    await supabase.storage.from("tournament-posters").remove([fileName])
    return { error: "No se pudo crear el torneo." }
  }

  redirect(`/torneos/${tournamentId}`)
}