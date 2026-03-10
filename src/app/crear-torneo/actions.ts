"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { v4 as uuidv4 } from "uuid"

export async function createTournament(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Debes iniciar sesión")

  const title = (formData.get("title") as string | null)?.trim() ?? ""
  const description = (formData.get("description") as string | null)?.trim() ?? ""
  const city = (formData.get("city") as string | null)?.trim() ?? ""
  const address = (formData.get("address") as string | null)?.trim() ?? ""
  const date = (formData.get("date") as string | null)?.trim() ?? ""
  const deadline = (formData.get("registration_deadline") as string | null)?.trim() ?? ""
  const isPublic = formData.get("is_public") === "on"
  const file = formData.get("poster") as File | null

  if (!title) throw new Error("El título es obligatorio")
  if (!file || file.size === 0) throw new Error("El cartel es obligatorio")

  if (deadline && date && new Date(deadline) > new Date(date)) {
    throw new Error("La fecha límite no puede ser posterior al torneo")
  }

  const fileExt = file.name.split(".").pop() ?? "jpg"
  const fileName = `${user.id}-${uuidv4()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from("tournament-posters")
    .upload(fileName, file)

  if (uploadError) throw new Error("Error al subir el cartel")

  const { data: publicUrlData } = supabase.storage
    .from("tournament-posters")
    .getPublicUrl(fileName)

  const posterUrl = publicUrlData.publicUrl

  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      organizer_id: user.id,
      title,
      description: description || null,
      poster_url: posterUrl,
      city: city || null,
      address: address || null,
      date: date || null,
      registration_deadline: deadline || null,
      is_public: isPublic,

      // defaults: se decide en /estructura
      has_categories: true,
      min_participants: 1,
      max_participants: null,
      payment_method: null,
      prizes: null,
      rules: null,

      status: "draft",
    })
    .select("id")
    .single()

  if (error) throw new Error(error.message)

  redirect(`/torneo/${data.id}/estructura`)
}