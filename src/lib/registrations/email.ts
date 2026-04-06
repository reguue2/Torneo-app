type EmailDispatchStatus = "sent" | "provider_not_configured" | "provider_error"

export type VerificationEmailPayload = {
  requestId: string
  recipientEmail: string
  verificationCode: string
  verificationToken: string
  expiresAt: string
  verifyUrl: string
}

export type ConfirmationEmailPayload = {
  recipientEmail: string
  tournamentTitle: string
  categoryName?: string | null
  publicReference: string
  registrationStatus: string | null
  paymentMethod: "cash" | "online" | null
  amount: number | null
  cancelCode?: string | null
  cancelUrl?: string | null
}

export type EmailDispatchResult = {
  status: EmailDispatchStatus
  message: string
}

function getEmailConfig() {
  return {
    provider: (process.env.REGISTRATION_EMAIL_PROVIDER ?? "resend").trim().toLowerCase(),
    resendApiKey: process.env.RESEND_API_KEY?.trim() ?? "",
    from:
      process.env.REGISTRATION_EMAIL_FROM?.trim() ||
      "Organiza Torneo <integrowagency@gmail.com>",
    replyTo:
      process.env.REGISTRATION_EMAIL_REPLY_TO?.trim() ||
      process.env.REGISTRATION_SUPPORT_EMAIL?.trim() ||
      undefined,
    supportEmail:
      process.env.REGISTRATION_SUPPORT_EMAIL?.trim() || "integrowagency@gmail.com",
  }
}

function formatMoney(value: number | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return "—"

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function getRegistrationStatusLabel(status: string | null | undefined) {
  if (status === "confirmed") return "Confirmada"
  if (status === "pending_cash_validation") return "Pendiente de validación en efectivo"
  if (status === "pending_online_payment") return "Pendiente de pago online"
  if (status === "cancelled") return "Cancelada"
  return status ?? "—"
}

async function sendWithResend(args: {
  to: string
  subject: string
  html: string
  text: string
}) {
  const config = getEmailConfig()

  if (config.provider !== "resend") {
    return {
      status: "provider_not_configured" as const,
      message:
        "El proveedor de correo no está configurado. Ajusta REGISTRATION_EMAIL_PROVIDER y las variables del remitente.",
    }
  }

  if (!config.resendApiKey) {
    return {
      status: "provider_not_configured" as const,
      message:
        "Falta RESEND_API_KEY. Configúrala en el .env antes de enviar correos reales.",
    }
  }

  if (!config.from) {
    return {
      status: "provider_not_configured" as const,
      message:
        "Falta REGISTRATION_EMAIL_FROM. Configura el remitente en el .env.",
    }
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      }),
      cache: "no-store",
    })

    const payload = (await response.json().catch(() => null)) as
      | { message?: string; name?: string }
      | null

    if (!response.ok) {
      const providerMessage = payload?.message ?? "No se pudo enviar el correo."

      if (
        providerMessage.includes("verify a domain") ||
        providerMessage.includes("domain is not verified") ||
        providerMessage.includes("resend.dev")
      ) {
        return {
          status: "provider_error" as const,
          message:
            "El proveedor está configurado, pero el remitente todavía no está listo. En Resend necesitas un dominio verificado en REGISTRATION_EMAIL_FROM.",
        }
      }

      return {
        status: "provider_error" as const,
        message: `El proveedor de correo devolvió un error: ${providerMessage}`,
      }
    }

    return {
      status: "sent" as const,
      message: "Correo enviado correctamente.",
    }
  } catch (error) {
    return {
      status: "provider_error" as const,
      message:
        error instanceof Error
          ? `No se pudo contactar con el proveedor de correo: ${error.message}`
          : "No se pudo contactar con el proveedor de correo.",
    }
  }
}

export async function dispatchRegistrationVerificationEmail(
  payload: VerificationEmailPayload
): Promise<EmailDispatchResult> {
  const supportEmail = getEmailConfig().supportEmail

  return sendWithResend({
    to: payload.recipientEmail,
    subject: "Valida tu inscripción en Organiza Torneo",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin: 0 0 16px;">Valida tu inscripción</h2>
        <p>Hemos recibido tu solicitud de inscripción. Antes de crear la inscripción real, necesitas validar tu email.</p>
        <p><strong>Código de verificación:</strong> ${payload.verificationCode}</p>
        <p><strong>Caduca:</strong> ${new Date(payload.expiresAt).toLocaleString("es-ES")}</p>
        <p style="margin: 24px 0;">
          <a href="${payload.verifyUrl}" style="display: inline-block; padding: 12px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 10px; font-weight: 600;">Validar inscripción</a>
        </p>
        <p>Si el botón no te funciona, copia y pega este enlace:</p>
        <p><a href="${payload.verifyUrl}">${payload.verifyUrl}</a></p>
        <p>Si no has pedido esta inscripción, ignora este mensaje.</p>
        <p style="color: #6b7280; font-size: 14px;">Soporte: ${supportEmail}</p>
      </div>
    `,
    text: [
      "Valida tu inscripción en Organiza Torneo",
      "",
      "Necesitas validar tu email antes de crear la inscripción real.",
      `Código de verificación: ${payload.verificationCode}`,
      `Caduca: ${new Date(payload.expiresAt).toLocaleString("es-ES")}`,
      `Enlace de validación: ${payload.verifyUrl}`,
      `Soporte: ${supportEmail}`,
    ].join("\n"),
  })
}

export async function dispatchRegistrationConfirmationEmail(
  payload: ConfirmationEmailPayload
): Promise<EmailDispatchResult> {
  const supportEmail = getEmailConfig().supportEmail
  const paymentLabel =
    payload.paymentMethod === "cash"
      ? "Efectivo"
      : payload.paymentMethod === "online"
        ? "Online"
        : "—"

  return sendWithResend({
    to: payload.recipientEmail,
    subject: "Tu inscripción ya está creada",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin: 0 0 16px;">Tu inscripción ya está creada</h2>
        <p><strong>Torneo:</strong> ${payload.tournamentTitle}</p>
        ${payload.categoryName ? `<p><strong>Categoría:</strong> ${payload.categoryName}</p>` : ""}
        <p><strong>Referencia pública:</strong> ${payload.publicReference}</p>
        <p><strong>Estado:</strong> ${getRegistrationStatusLabel(payload.registrationStatus)}</p>
        <p><strong>Canal de pago:</strong> ${paymentLabel}</p>
        <p><strong>Importe:</strong> ${formatMoney(payload.amount)}</p>
        ${payload.cancelCode ? `<p><strong>Código de cancelación:</strong> ${payload.cancelCode}</p>` : ""}
        ${payload.cancelUrl ? `<p><strong>Enlace de cancelación:</strong> <a href="${payload.cancelUrl}">${payload.cancelUrl}</a></p>` : ""}
        <p style="margin-top: 24px;">Guarda este correo. Es la forma más segura de conservar la referencia y los datos de cancelación.</p>
        <p style="color: #6b7280; font-size: 14px;">Soporte: ${supportEmail}</p>
      </div>
    `,
    text: [
      "Tu inscripción ya está creada",
      `Torneo: ${payload.tournamentTitle}`,
      ...(payload.categoryName ? [`Categoría: ${payload.categoryName}`] : []),
      `Referencia pública: ${payload.publicReference}`,
      `Estado: ${getRegistrationStatusLabel(payload.registrationStatus)}`,
      `Canal de pago: ${paymentLabel}`,
      `Importe: ${formatMoney(payload.amount)}`,
      ...(payload.cancelCode ? [`Código de cancelación: ${payload.cancelCode}`] : []),
      ...(payload.cancelUrl ? [`Enlace de cancelación: ${payload.cancelUrl}`] : []),
      `Soporte: ${supportEmail}`,
    ].join("\n"),
  })
}
