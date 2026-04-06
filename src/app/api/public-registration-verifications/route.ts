import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchRegistrationConfirmationEmail } from "@/lib/registrations/email"
import type { Json } from "@/types/database"

const VerifySchema = z
  .object({
    requestId: z.string().uuid(),
    verificationToken: z.string().trim().optional(),
    verificationCode: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.verificationToken && !value.verificationCode) {
      ctx.addIssue({
        code: "custom",
        message: "Debes enviar un token o un código de verificación.",
        path: ["verificationToken"],
      })
    }
  })

type VerificationResult = {
  already_verified: boolean
  public_reference: string | null
  registration_status: string | null
  payment_method: "cash" | "online" | null
  amount: number | null
  cancel_code: string | null
  cancel_token: string | null
}

function resolveOrigin(request: Request) {
  const explicitOrigin = request.headers.get("origin")
  if (explicitOrigin) return explicitOrigin

  const forwardedProto = request.headers.get("x-forwarded-proto")
  const forwardedHost = request.headers.get("x-forwarded-host")

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  const host = request.headers.get("host")
  if (host) {
    return `${forwardedProto ?? "https"}://${host}`
  }

  return new URL(request.url).origin
}

function isObject(value: Json | null): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseVerificationResult(value: Json | null): VerificationResult | null {
  if (!isObject(value)) return null

  const alreadyVerified = value.already_verified
  const publicReference = value.public_reference
  const registrationStatus = value.registration_status
  const paymentMethod = value.payment_method
  const amount = value.amount
  const cancelCode = value.cancel_code
  const cancelToken = value.cancel_token

  if (typeof alreadyVerified !== "boolean") return null
  if (publicReference !== null && typeof publicReference !== "string") return null
  if (registrationStatus !== null && typeof registrationStatus !== "string") return null
  if (paymentMethod !== null && paymentMethod !== "cash" && paymentMethod !== "online") {
    return null
  }
  if (amount !== null && typeof amount !== "number") return null
  if (cancelCode !== null && typeof cancelCode !== "string") return null
  if (cancelToken !== null && typeof cancelToken !== "string") return null

  return {
    already_verified: alreadyVerified,
    public_reference: publicReference,
    registration_status: registrationStatus,
    payment_method: paymentMethod,
    amount,
    cancel_code: cancelCode,
    cancel_token: cancelToken,
  }
}

export async function POST(request: Request) {
  let rawBody: unknown

  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la petición no es válido." },
      { status: 400 }
    )
  }

  const parsed = VerifySchema.safeParse(rawBody)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Los datos de verificación no son válidos." },
      { status: 400 }
    )
  }

  try {
    const supabase = createAdminClient()
    const callRpc = supabase.rpc as unknown as (
      fn: string,
      args?: Record<string, unknown>
    ) => Promise<{ data: Json | null; error: { message: string } | null }>

    const { data, error } = await callRpc("verify_public_registration_request", {
      p_request_id: parsed.data.requestId,
      p_verification_token: parsed.data.verificationToken || undefined,
      p_verification_code: parsed.data.verificationCode || undefined,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const result = parseVerificationResult(data)

    if (!result) {
      return NextResponse.json(
        { error: "La respuesta del servidor no tiene el formato esperado." },
        { status: 500 }
      )
    }

    let emailDeliveryStatus: "sent" | "provider_not_configured" | "provider_error" | null = null
    let emailDeliveryMessage: string | null = null

    if (!result.already_verified && result.public_reference) {
      const { data: requestRow } = await supabase
        .from("registration_requests")
        .select("contact_email, tournament_id, category_id")
        .eq("id", parsed.data.requestId)
        .maybeSingle()

      if (requestRow?.contact_email) {
        const { data: tournamentRow } = await supabase
          .from("tournaments")
          .select("title")
          .eq("id", requestRow.tournament_id)
          .maybeSingle()

        let categoryName: string | null = null

        if (requestRow.category_id) {
          const { data: categoryRow } = await supabase
            .from("categories")
            .select("name")
            .eq("id", requestRow.category_id)
            .maybeSingle()

          categoryName = categoryRow?.name ?? null
        }

        const cancelUrl = result.cancel_token
          ? `${resolveOrigin(request)}/inscripcion/cancelar?reference=${encodeURIComponent(
              result.public_reference
            )}&token=${encodeURIComponent(result.cancel_token)}`
          : null

        const delivery = await dispatchRegistrationConfirmationEmail({
          recipientEmail: requestRow.contact_email,
          tournamentTitle: tournamentRow?.title ?? "Organiza Torneo",
          categoryName,
          publicReference: result.public_reference,
          registrationStatus: result.registration_status,
          paymentMethod: result.payment_method,
          amount: result.amount,
          cancelCode: result.cancel_code,
          cancelUrl,
        })

        emailDeliveryStatus = delivery.status
        emailDeliveryMessage = delivery.message
      }
    }

    return NextResponse.json({
      ...result,
      email_delivery_status: emailDeliveryStatus,
      email_delivery_message: emailDeliveryMessage,
    })
  } catch (error) {
    console.error("public registration verification route failed:", error)

    return NextResponse.json(
      { error: "No se pudo validar la inscripción." },
      { status: 500 }
    )
  }
}
