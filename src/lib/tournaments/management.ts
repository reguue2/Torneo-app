export type TournamentStatus =
  | "draft"
  | "published"
  | "closed"
  | "finished"
  | "cancelled"

export type RegistrationStatus =
  | "pending"
  | "paid"
  | "cancelled"
  | "pending_verification"
  | "pending_cash_validation"
  | "pending_online_payment"
  | "confirmed"
  | "expired"

export type RegistrationPaymentMethod = "cash" | "online" | null

export type TournamentRow = {
  id: string
  organizer_id?: string
  title: string
  description: string | null
  rules: string | null
  province: string | null
  address: string | null
  date: string | null
  registration_deadline: string | null
  status: TournamentStatus | null
  has_categories: boolean
  payment_method: "cash" | "online" | "both" | null
  is_public: boolean | null
  min_participants: number
  max_participants: number | null
  entry_price: number
}

export type CategoryRow = {
  id: string
  tournament_id: string
  name: string
  price: number
  min_participants: number
  max_participants: number | null
}

export type RegistrationRow = {
  id: string
  tournament_id: string
  category_id: string | null
  participant_id: string
  status: RegistrationStatus | null
  payment_method: RegistrationPaymentMethod
  public_reference: string | null
  created_at: string | null
  cancelled_at: string | null
}

export type ParticipantRow = {
  id: string
  type: "individual" | "team"
  display_name: string
  contact_phone: string
  contact_email: string | null
  players: unknown
}

export type PaymentRow = {
  id: string
  registration_id: string
  amount: number
  payment_method: "cash" | "online" | null
  status: "pending" | "paid" | "refunded" | null
  paid_at: string | null
  created_at: string | null
}

export const ACTIVE_REGISTRATION_STATUSES: RegistrationStatus[] = [
  "pending",
  "paid",
  "pending_verification",
  "pending_cash_validation",
  "pending_online_payment",
  "confirmed",
]

export const PENDING_MANUAL_REVIEW_STATUSES: RegistrationStatus[] = [
  "pending",
  "pending_cash_validation",
]

export const CONFIRMABLE_ONLINE_STATUSES: RegistrationStatus[] = [
  "pending_online_payment",
]

export const CANCELLABLE_BY_ORGANIZER_STATUSES: RegistrationStatus[] = [
  "pending",
  "paid",
  "pending_cash_validation",
  "pending_online_payment",
  "confirmed",
]