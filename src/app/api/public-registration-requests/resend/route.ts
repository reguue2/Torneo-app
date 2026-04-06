import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { dispatchRegistrationVerificationEmail } from "@/lib/registrations/email"
import type { Json } from "@/types/database"

const ResendSchema = z.object({
  requestId: z.string().uuid(),
})

type ResendRequestRpcResult = {
  request_id: string
  verification_code: string
  verification_token: string
  expires_at: string
  amount: number
  payment_method: "cash" | "online"
  contact_email: string
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

function parseRpcResult(value: Json | null): ResendRequestRpcResult | null {
  if (!isObject(value)) return null

  const requestId = value.request_id
  const verificationCode = value.verification_code
  const verificationToken = value.verification_token
  const expiresAt = value.expires_at
  const amount = value.amount
  const paymentMethod = value.payment_method
  const contactEmail = value.contact_email

  if (
    typeof requestId !== "string" ||
    typeof verificationCode !== "string" ||
    typeof verificationToken !== "string" ||
    typeof expiresAt !== "string" ||
    typeof amount !== "number" ||
    typeof contactEmail !== "string" ||
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
    contact_email: contactEmail,
  }
}

function extractRetryAfterSeconds(message: string) {
  const match = message.match(/(\d+)\s*seconds? remaining/i)
  if (!match) return null

  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
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

  const parsed = ResendSchema.safeParse(rawBody)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Los datos del reenvío no son válidos." },
      { status: 400 }
    )
  }

  try {
    const supabase = createAdminClient()
    const callRpc = supabase.rpc as unknown as (
      fn: string,
      args?: Record<string, unknown>
    ) => Promise<{ data: Json | null; error: { message: string } | null }>

    const { data, error } = await callRpc("resend_public_registration_request", {
      p_request_id: parsed.data.requestId,
    })

    if (error) {
      const retryAfter = extractRetryAfterSeconds(error.message)

      if (retryAfter !== null) {
        return NextResponse.json(
          { error: error.message, retry_after_seconds: retryAfter },
          { status: 429 }
        )
      }

      if (error.message.includes("Resend limit reached")) {
        return NextResponse.json(
          { error: error.message },
          { status: 429 }
        )
      }

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
      recipientEmail: result.contact_email,
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
    console.error("resend public registration request route failed:", error)

    return NextResponse.json(
      { error: "No se pudo reenviar la verificación." },
      { status: 500 }
    )
  }
}
