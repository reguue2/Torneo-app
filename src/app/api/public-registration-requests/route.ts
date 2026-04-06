import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchRegistrationVerificationEmail } from "@/lib/registrations/email"
import type { Json } from "@/types/database"

const CreatePublicRegistrationRequestSchema = z.object({
  tournamentId: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
  displayName: z.string().trim().min(1),
  contactPhone: z.string().trim().min(1),
  contactEmail: z.string().trim().email(),
  paymentMethod: z.enum(["cash", "online"]),
})

type PublicRegistrationRequestRpcResult = {
  request_id: string
  verification_code: string
  verification_token: string
  expires_at: string
  amount: number
  payment_method: "cash" | "online"
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

function parseRpcResult(value: Json | null): PublicRegistrationRequestRpcResult | null {
  if (!isObject(value)) return null

  const requestId = value.request_id
  const verificationCode = value.verification_code
  const verificationToken = value.verification_token
  const expiresAt = value.expires_at
  const amount = value.amount
  const paymentMethod = value.payment_method

  if (
    typeof requestId !== "string" ||
    typeof verificationCode !== "string" ||
    typeof verificationToken !== "string" ||
    typeof expiresAt !== "string" ||
    typeof amount !== "number" ||
    (paymentMethod !== "cash" && paymentMethod !== "online")
  ) {
    return null
  }

  return {
    request_id: requestId,
    verification_code: verificationCode,
    verification_token: verificationToken,
    expires_at: expiresAt,
    amount,
    payment_method: paymentMethod,
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

  const parsed = CreatePublicRegistrationRequestSchema.safeParse(rawBody)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Los datos de la solicitud no son válidos." },
      { status: 400 }
    )
  }

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc("create_public_registration_request", {
      p_tournament_id: parsed.data.tournamentId,
      p_category_id: parsed.data.categoryId ?? undefined,
      p_display_name: parsed.data.displayName,
      p_contact_phone: parsed.data.contactPhone,
      p_contact_email: parsed.data.contactEmail,
      p_payment_method: parsed.data.paymentMethod,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const result = parseRpcResult(data)

    if (!result) {
      return NextResponse.json(
        { error: "La respuesta del servidor no tiene el formato esperado." },
        { status: 500 }
      )
    }

    const verifyUrl = `${resolveOrigin(request)}/inscripcion/verificar?request=${encodeURIComponent(
      result.request_id
    )}&token=${encodeURIComponent(result.verification_token)}`

    const delivery = await dispatchRegistrationVerificationEmail({
      requestId: result.request_id,
      recipientEmail: parsed.data.contactEmail,
      verificationCode: result.verification_code,
      verificationToken: result.verification_token,
      expiresAt: result.expires_at,
      verifyUrl,
    })

    return NextResponse.json({
      request_id: result.request_id,
      expires_at: result.expires_at,
      amount: result.amount,
      payment_method: result.payment_method,
      email_delivery_status: delivery.status,
      email_delivery_message: delivery.message,
    })
  } catch (error) {
    console.error("public registration request route failed:", error)

    return NextResponse.json(
      { error: "No se pudo crear la solicitud de inscripción." },
      { status: 500 }
    )
  }
}