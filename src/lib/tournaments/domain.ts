export type TournamentStatus =
  | "draft"
  | "published"
  | "closed"
  | "finished"
  | "cancelled"
  | null

export type TournamentPaymentMethod = "cash" | "online" | "both" | null
export type PrizeMode = "none" | "global" | "per_category"

export type PublicTournamentLike = {
  status: TournamentStatus
  registration_deadline: string | null
  payment_method: TournamentPaymentMethod
  is_public: boolean | null
}

export type PublicationTournamentLike = {
  title: string
  province: string | null
  address: string | null
  date: string | null
  registration_deadline: string | null
  payment_method: TournamentPaymentMethod
  has_categories: boolean
  min_participants: number
  max_participants: number | null
  entry_price: number
  prize_mode: PrizeMode
  prizes: string | null
}

export type PublicationCategoryLike = {
  id: string
  name: string
  price: number
  min_participants: number
  max_participants: number | null
  prizes: string | null
}

export function formatMoney(value: number | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value)

  if (!Number.isFinite(amount)) return "—"
  if (amount === 0) return "Gratis"

  const text = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2).replace(/\.00$/, "")

  return `${text}€`
}

export function formatDate(value: string | null, withWeekday = false) {
  if (!value) return "Por definir"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Por definir"

  return date.toLocaleDateString("es-ES", {
    weekday: withWeekday ? "long" : undefined,
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function paymentMethodLabel(method: TournamentPaymentMethod) {
  if (!method) return "Por definir"
  if (method === "cash") return "Solo efectivo"
  if (method === "online") return "Solo online"
  return "Efectivo y online"
}

export function getPublicVisibilityLabel(isPublic: boolean | null | undefined) {
  if (isPublic ?? true) {
    return "Torneo público"
  }

  return "Oculto del explorador. Acceso directo por enlace"
}

export function getExploreStatus(
  tournament: Pick<PublicTournamentLike, "status" | "registration_deadline">
) {
  if (tournament.status === "finished") {
    return {
      label: "Finalizado",
      className: "bg-gray-700 text-white",
    }
  }

  if (tournament.status === "cancelled") {
    return {
      label: "Cancelado",
      className: "bg-red-600 text-white",
    }
  }

  if (tournament.status === "closed") {
    return {
      label: "Cerrado",
      className: "bg-red-500 text-white",
    }
  }

  const deadline = tournament.registration_deadline
    ? new Date(tournament.registration_deadline)
    : null

  if (deadline && !Number.isNaN(deadline.getTime()) && deadline < new Date()) {
    return {
      label: "Cerrado",
      className: "bg-red-500 text-white",
    }
  }

  return {
    label: "Abierto",
    className: "bg-green-500 text-white",
  }
}

export function getSidebarStatus(
  tournament: Pick<PublicTournamentLike, "status" | "registration_deadline">
) {
  if (tournament.status === "finished") {
    return {
      label: "Finalizado",
      badge: "bg-gray-100 text-gray-700 border border-gray-200",
    }
  }

  if (tournament.status === "cancelled") {
    return {
      label: "Cancelado",
      badge: "bg-red-50 text-red-700 border border-red-200",
    }
  }

  if (tournament.status === "closed") {
    return {
      label: "Cerrado",
      badge: "bg-amber-50 text-amber-700 border border-amber-200",
    }
  }

  const deadline = tournament.registration_deadline
    ? new Date(tournament.registration_deadline)
    : null

  if (deadline && !Number.isNaN(deadline.getTime()) && deadline < new Date()) {
    return {
      label: "Inscripción cerrada",
      badge: "bg-amber-50 text-amber-700 border border-amber-200",
    }
  }

  return {
    label: "Inscripción abierta",
    badge: "bg-green-50 text-green-700 border border-green-200",
  }
}

export function getRegistrationState(tournament: PublicTournamentLike) {
  if (tournament.status === "cancelled") {
    return {
      canJoin: false,
      title: "Torneo cancelado",
      message: "Este torneo ha sido cancelado.",
      buttonLabel: "Inscripción no disponible",
    }
  }

  if (tournament.status === "finished") {
    return {
      canJoin: false,
      title: "Torneo finalizado",
      message: "Este torneo ya ha finalizado.",
      buttonLabel: "Inscripción no disponible",
    }
  }

  if (tournament.status === "closed") {
    return {
      canJoin: false,
      title: "Inscripciones cerradas",
      message: "Las inscripciones están cerradas.",
      buttonLabel: "Inscripción cerrada",
    }
  }

  const deadline = tournament.registration_deadline
    ? new Date(tournament.registration_deadline)
    : null

  if (deadline && !Number.isNaN(deadline.getTime()) && deadline < new Date()) {
    return {
      canJoin: false,
      title: "Fuera de plazo",
      message: "La fecha límite de inscripción ya ha pasado.",
      buttonLabel: "Fuera de plazo",
    }
  }

  if (!tournament.payment_method) {
    return {
      canJoin: false,
      title: "Inscripción no disponible",
      message: "Este torneo todavía no tiene un método de pago configurado.",
      buttonLabel: "Inscripción no disponible",
    }
  }

  if (tournament.payment_method === "cash") {
    return {
      canJoin: true,
      title: "Inscripción disponible",
      message:
        "Puedes crear tu solicitud ahora. Primero validarás el email y después el organizador revisará el pago en efectivo si corresponde.",
      buttonLabel: "Inscribirse al torneo",
    }
  }

  if (tournament.payment_method === "online") {
    return {
      canJoin: true,
      title: "Inscripción disponible",
      message:
        "Puedes iniciar tu solicitud ahora. Primero validarás el email y después seguirás el flujo de pago online cuando esté conectado.",
      buttonLabel: "Inscribirse al torneo",
    }
  }

  return {
    canJoin: true,
    title: "Inscripción disponible",
    message:
      "Puedes iniciar tu solicitud ahora. Primero validarás el email y después elegirás el canal de pago que corresponda.",
    buttonLabel: "Inscribirse al torneo",
  }
}

export function validateTournamentForPublication(
  tournament: PublicationTournamentLike,
  categories: PublicationCategoryLike[]
) {
  const issues: string[] = []

  if (!tournament.payment_method) {
    issues.push("Falta configurar el método de pago.")
  }

  if (!tournament.date) {
    issues.push("Falta indicar la fecha del torneo.")
  }

  if (!tournament.registration_deadline) {
    issues.push("Falta indicar la fecha límite de inscripción.")
  }

  if (!tournament.province?.trim()) {
    issues.push("Falta indicar la provincia.")
  }

  if (!tournament.address?.trim()) {
    issues.push("Falta indicar la dirección.")
  }

  if (tournament.date && tournament.registration_deadline) {
    const date = new Date(tournament.date)
    const deadline = new Date(tournament.registration_deadline)

    if (
      !Number.isNaN(date.getTime()) &&
      !Number.isNaN(deadline.getTime()) &&
      deadline > date
    ) {
      issues.push(
        "La fecha límite de inscripción no puede ser posterior a la fecha del torneo."
      )
    }
  }

  if (
    typeof tournament.min_participants !== "number" ||
    tournament.min_participants <= 0 ||
    (tournament.max_participants !== null &&
      tournament.max_participants < tournament.min_participants)
  ) {
    issues.push("Revisa el mínimo y máximo de participantes del torneo.")
  }

  if (!tournament.has_categories) {
    if (
      !Number.isFinite(Number(tournament.entry_price)) ||
      Number(tournament.entry_price) < 0
    ) {
      issues.push("Revisa el precio del torneo.")
    }
  }

  if (tournament.has_categories) {
    if (categories.length === 0) {
      issues.push("Debes crear al menos una categoría.")
    }

    const invalidCategory = categories.some(
      (category) =>
        !category.name.trim() ||
        !Number.isFinite(Number(category.price)) ||
        Number(category.price) < 0 ||
        category.min_participants <= 0 ||
        (category.max_participants !== null &&
          category.max_participants < category.min_participants)
    )

    if (invalidCategory) {
      issues.push("Revisa las categorías, sus precios y sus cupos.")
    }
  }

  if (tournament.prize_mode === "global" && !tournament.prizes?.trim()) {
    issues.push(
      "Has elegido premios globales, pero no has rellenado el bloque de premios."
    )
  }

  if (
    tournament.prize_mode === "per_category" &&
    (categories.length === 0 ||
      categories.some((category) => !category.prizes?.trim()))
  ) {
    issues.push(
      "Has elegido premios por categoría, pero falta rellenarlos en una o más categorías."
    )
  }

  return {
    canPublish: issues.length === 0,
    issues,
  }
}