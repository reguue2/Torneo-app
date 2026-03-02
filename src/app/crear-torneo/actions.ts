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

  const title = formData.get("title") as string
  const description = formData.get("description") as string
  const city = formData.get("city") as string
  const address = formData.get("address") as string
  const date = formData.get("date") as string
  const deadline = formData.get("registration_deadline") as string
  const prizes = formData.get("prizes") as string
  const rules = formData.get("rules") as string
  const maxParticipants = Number(formData.get("max_participants"))
  const isPublic = formData.get("is_public") === "on"
  const file = formData.get("poster") as File

  if (!title) throw new Error("El título es obligatorio")
  if (!file || file.size === 0)
    throw new Error("El cartel es obligatorio")

  if (maxParticipants <= 0)
    throw new Error("El máximo de participantes debe ser mayor a 0")

  if (deadline && date && new Date(deadline) > new Date(date))
    throw new Error("La fecha límite no puede ser posterior al torneo")

  const fileExt = file.name.split(".").pop()
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
      description,
      poster_url: posterUrl,
      prizes,
      rules,
      city,
      address,
      date,
      registration_deadline: deadline,
      max_participants: maxParticipants,
      is_public: isPublic,
      has_categories: true, 
      status: "draft",
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  redirect(`/torneo/${data.id}/estructura`)
}