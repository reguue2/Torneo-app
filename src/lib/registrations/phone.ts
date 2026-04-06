export function normalizeSpanishPhone(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  let digits = trimmed.replace(/\D/g, "")

  if (digits.startsWith("0034")) {
    digits = digits.slice(4)
  } else if (digits.startsWith("34") && digits.length === 11) {
    digits = digits.slice(2)
  }

  if (!/^[6789]\d{8}$/.test(digits)) {
    return null
  }

  return digits
}

export function isValidSpanishPhone(value: string) {
  return normalizeSpanishPhone(value) !== null
}

export function getSpanishPhoneValidationMessage(value: string) {
  if (!value.trim()) {
    return "El teléfono de contacto es obligatorio."
  }

  return isValidSpanishPhone(value)
    ? null
    : "Introduce un teléfono español válido."
}
