export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          tournament_id: string
          name: string
          price: number
          min_participants: number
          max_participants: number | null
          start_at: string | null
          address: string | null
          prizes: string | null
        }
        Insert: {
          id?: string
          tournament_id: string
          name: string
          price: number
          min_participants?: number
          max_participants?: number | null
          start_at?: string | null
          address?: string | null
          prizes?: string | null
        }
        Update: {
          id?: string
          tournament_id?: string
          name?: string
          price?: number
          min_participants?: number
          max_participants?: number | null
          start_at?: string | null
          address?: string | null
          prizes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          id: string
          type: Database["public"]["Enums"]["participant_type"]
          display_name: string
          contact_phone: string
          contact_email: string | null
          players: Json | null
          created_at: string
          source_registration_id: string | null
        }
        Insert: {
          id?: string
          type: Database["public"]["Enums"]["participant_type"]
          display_name: string
          contact_phone: string
          contact_email?: string | null
          players?: Json | null
          created_at?: string
          source_registration_id?: string | null
        }
        Update: {
          id?: string
          type?: Database["public"]["Enums"]["participant_type"]
          display_name?: string
          contact_phone?: string
          contact_email?: string | null
          players?: Json | null
          created_at?: string
          source_registration_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          registration_id: string
          amount: number
          currency: string | null
          payment_method: Database["public"]["Enums"]["registration_payment_method"] | null
          status: Database["public"]["Enums"]["payment_status"] | null
          stripe_payment_intent_id: string | null
          paid_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          registration_id: string
          amount: number
          currency?: string | null
          payment_method?: Database["public"]["Enums"]["registration_payment_method"] | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          stripe_payment_intent_id?: string | null
          paid_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          registration_id?: string
          amount?: number
          currency?: string | null
          payment_method?: Database["public"]["Enums"]["registration_payment_method"] | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          stripe_payment_intent_id?: string | null
          paid_at?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_requests: {
        Row: {
          id: string
          tournament_id: string
          category_id: string | null
          participant_type: Database["public"]["Enums"]["participant_type"]
          display_name: string
          contact_phone: string
          contact_phone_normalized: string
          contact_email: string
          contact_email_normalized: string
          players: Json | null
          payment_method: Database["public"]["Enums"]["registration_payment_method"]
          verification_code_hash: string
          verification_token_hash: string
          expires_at: string
          verified_at: string | null
          consumed_at: string | null
          registration_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          category_id?: string | null
          participant_type: Database["public"]["Enums"]["participant_type"]
          display_name: string
          contact_phone: string
          contact_phone_normalized: string
          contact_email: string
          contact_email_normalized: string
          players?: Json | null
          payment_method: Database["public"]["Enums"]["registration_payment_method"]
          verification_code_hash: string
          verification_token_hash: string
          expires_at: string
          verified_at?: string | null
          consumed_at?: string | null
          registration_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          category_id?: string | null
          participant_type?: Database["public"]["Enums"]["participant_type"]
          display_name?: string
          contact_phone?: string
          contact_phone_normalized?: string
          contact_email?: string
          contact_email_normalized?: string
          players?: Json | null
          payment_method?: Database["public"]["Enums"]["registration_payment_method"]
          verification_code_hash?: string
          verification_token_hash?: string
          expires_at?: string
          verified_at?: string | null
          consumed_at?: string | null
          registration_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_requests_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_requests_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          id: string
          category_id: string | null
          tournament_id: string
          participant_id: string
          status: Database["public"]["Enums"]["registration_status"] | null
          payment_method: Database["public"]["Enums"]["registration_payment_method"] | null
          created_at: string | null
          public_reference: string | null
          contact_email_normalized: string | null
          contact_phone_normalized: string | null
          cancel_code_hash: string | null
          cancel_token_hash: string | null
          cancelled_at: string | null
        }
        Insert: {
          id?: string
          category_id?: string | null
          tournament_id: string
          participant_id: string
          status?: Database["public"]["Enums"]["registration_status"] | null
          payment_method?: Database["public"]["Enums"]["registration_payment_method"] | null
          created_at?: string | null
          public_reference?: string | null
          contact_email_normalized?: string | null
          contact_phone_normalized?: string | null
          cancel_code_hash?: string | null
          cancel_token_hash?: string | null
          cancelled_at?: string | null
        }
        Update: {
          id?: string
          category_id?: string | null
          tournament_id?: string
          participant_id?: string
          status?: Database["public"]["Enums"]["registration_status"] | null
          payment_method?: Database["public"]["Enums"]["registration_payment_method"] | null
          created_at?: string | null
          public_reference?: string | null
          contact_email_normalized?: string | null
          contact_phone_normalized?: string | null
          cancel_code_hash?: string | null
          cancel_token_hash?: string | null
          cancelled_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          id: string
          organizer_id: string
          title: string
          description: string | null
          poster_url: string | null
          prizes: string | null
          rules: string | null
          province: string | null
          address: string | null
          date: string | null
          max_participants: number | null
          min_participants: number
          registration_deadline: string | null
          payment_method: Database["public"]["Enums"]["payment_method_enum"] | null
          is_public: boolean | null
          status: Database["public"]["Enums"]["tournament_status"] | null
          created_at: string | null
          has_categories: boolean
          prize_mode: Database["public"]["Enums"]["prize_mode"]
          entry_price: number
          updated_at: string
        }
        Insert: {
          id?: string
          organizer_id: string
          title: string
          description?: string | null
          poster_url?: string | null
          prizes?: string | null
          rules?: string | null
          province?: string | null
          address?: string | null
          date?: string | null
          max_participants?: number | null
          min_participants?: number
          registration_deadline?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_enum"] | null
          is_public?: boolean | null
          status?: Database["public"]["Enums"]["tournament_status"] | null
          created_at?: string | null
          has_categories: boolean
          prize_mode?: Database["public"]["Enums"]["prize_mode"]
          entry_price?: number
          updated_at?: string
        }
        Update: {
          id?: string
          organizer_id?: string
          title?: string
          description?: string | null
          poster_url?: string | null
          prizes?: string | null
          rules?: string | null
          province?: string | null
          address?: string | null
          date?: string | null
          max_participants?: number | null
          min_participants?: number
          registration_deadline?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_enum"] | null
          is_public?: boolean | null
          status?: Database["public"]["Enums"]["tournament_status"] | null
          created_at?: string | null
          has_categories?: boolean
          prize_mode?: Database["public"]["Enums"]["prize_mode"]
          entry_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          phone: string | null
          stripe_account_id: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          phone?: string | null
          stripe_account_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          phone?: string | null
          stripe_account_id?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      apply_automatic_state_transitions: {
        Args: Record<PropertyKey, never>
        Returns: {
          finished_tournaments: number
          closed_tournaments: number
          expired_online_registrations: number
          deleted_open_requests: number
          deleted_consumed_requests: number
        }
      }
      cancel_pending_registration_by_organizer: {
        Args: { p_registration_id: string }
        Returns: {
          registration_id: string
          status: "cancelled"
        }
      }
      cancel_public_registration: {
        Args: {
          p_public_reference: string
          p_cancel_code?: string | null
          p_cancel_token?: string | null
        }
        Returns: {
          already_cancelled: boolean
          public_reference: string | null
          status: "cancelled"
        }
      }
      create_and_publish_tournament: {
        Args: {
          p_title: string
          p_description: string | null
          p_poster_url: string
          p_province: string
          p_address: string
          p_date: string
          p_registration_deadline: string
          p_is_public: boolean
          p_has_categories: boolean
          p_min_participants: number
          p_max_participants: number | null
          p_payment_method: Database["public"]["Enums"]["payment_method_enum"]
          p_prize_mode: Database["public"]["Enums"]["prize_mode"]
          p_prizes: string | null
          p_rules: string | null
          p_entry_price: number
          p_categories?: Json
        }
        Returns: string
      }
      create_public_registration_request: {
        Args: {
          p_tournament_id: string
          p_participant_type: Database["public"]["Enums"]["participant_type"]
          p_display_name: string
          p_contact_phone: string
          p_category_id?: string | null
          p_contact_email?: string | null
          p_players?: Json | null
          p_payment_method?: Database["public"]["Enums"]["registration_payment_method"]
        }
        Returns: {
          request_id: string
          verification_code: string
          verification_token: string
          expires_at: string
          amount: number
          payment_method: Database["public"]["Enums"]["registration_payment_method"]
        }
      }
      mark_cash_registration_paid: {
        Args: { p_registration_id: string }
        Returns: {
          registration_id: string
          status: "confirmed"
          amount: number
        }
      }
      mark_online_registration_paid: {
        Args: { p_registration_id: string }
        Returns: {
          registration_id: string
          status: "confirmed"
          amount: number
        }
      }
      publish_tournament: {
        Args: { p_tournament_id: string }
        Returns: string
      }
      set_tournament_management_status: {
        Args: {
          p_tournament_id: string
          p_next_status: Database["public"]["Enums"]["tournament_status"]
        }
        Returns: string
      }
      verify_public_registration_request: {
        Args: {
          p_request_id: string
          p_verification_code?: string | null
          p_verification_token?: string | null
        }
        Returns: {
          already_verified: boolean
          registration_id: string
          public_reference: string | null
          registration_status: Database["public"]["Enums"]["registration_status"] | null
          payment_method: Database["public"]["Enums"]["registration_payment_method"] | null
          amount?: number
          cancel_code?: string
          cancel_token?: string
        }
      }
    }
    Enums: {
      participant_type: "individual" | "team"
      payment_method_enum: "cash" | "online" | "both"
      payment_status: "pending" | "paid" | "refunded"
      prize_mode: "none" | "global" | "per_category"
      registration_payment_method: "cash" | "online"
      registration_status:
        | "pending"
        | "paid"
        | "cancelled"
        | "pending_verification"
        | "pending_cash_validation"
        | "pending_online_payment"
        | "confirmed"
        | "expired"
      tournament_status: "draft" | "published" | "closed" | "finished" | "cancelled"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof DatabaseWithoutInternals, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
          DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]
      )
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]
    )[TableName] extends { Row: infer R }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      participant_type: ["individual", "team"],
      payment_method_enum: ["cash", "online", "both"],
      payment_status: ["pending", "paid", "refunded"],
      prize_mode: ["none", "global", "per_category"],
      registration_payment_method: ["cash", "online"],
      registration_status: [
        "pending",
        "paid",
        "cancelled",
        "pending_verification",
        "pending_cash_validation",
        "pending_online_payment",
        "confirmed",
        "expired",
      ],
      tournament_status: ["draft", "published", "closed", "finished", "cancelled"],
    },
  },
} as const