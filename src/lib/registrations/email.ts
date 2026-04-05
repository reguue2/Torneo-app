export type VerificationEmailPayload = {
  requestId: string
  recipientEmail: string
  verificationCode: string
  verificationToken: string
  expiresAt: string
  verifyUrl: string
}

export type VerificationEmailDispatchResult = {
  status: "pending_provider_configuration"
  message: string
}

export async function dispatchRegistrationVerificationEmail(
  payload: VerificationEmailPayload
): Promise<VerificationEmailDispatchResult> {
  console.warn(
    [
      "[TODO] Verification email provider not configured.",
      `to=${payload.recipientEmail}`,
      `request_id=${payload.requestId}`,
      `expires_at=${payload.expiresAt}`,
      `verification_code=${payload.verificationCode}`,
      `verify_url=${payload.verifyUrl}`,
    ].join(" ")
  )

  return {
    status: "pending_provider_configuration",
    message:
      "La solicitud se ha creado de forma segura, pero el proveedor de correo todavía no está conectado.",
  }
}