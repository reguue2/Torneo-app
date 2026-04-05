export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          address: string | null
          id: string
          max_participants: number | null
          min_participants: number
          name: string
          price: number
          prizes: string | null
          start_at: string | null
          tournament_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          id?: string
          max_participants?: number | null
          min_participants?: number
          name: string
          price: number
          prizes?: string | null
          start_at?: string | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          id?: string
          max_participants?: number | null
          min_participants?: number
          name?: string
          price?: number
          prizes?: string | null
          start_at?: string | null
          tournament_id?: string
          updated_at?: string
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
          contact_email: string | null
          contact_phone: string
          created_at: string
          display_name: string
          id: string
          players: Json | null
          source_registration_id: string | null
          type: Database["public"]["Enums"]["participant_type"]
        }
        Insert: {
          contact_email?: string | null
          contact_phone: string
          created_at?: string
          display_name: string
          id?: string
          players?: Json | null
          source_registration_id?: string | null
          type: Database["public"]["Enums"]["participant_type"]
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string
          created_at?: string
          display_name?: string
          id?: string
          players?: Json | null
          source_registration_id?: string | null
          type?: Database["public"]["Enums"]["participant_type"]
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          paid_at: string | null
          payment_method:
            | Database["public"]["Enums"]["registration_payment_method"]
            | null
          registration_id: string
          status: Database["public"]["Enums"]["payment_status"] | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          paid_at?: string | null
          payment_method?:
            | Database["public"]["Enums"]["registration_payment_method"]
            | null
          registration_id: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          paid_at?: string | null
          payment_method?:
            | Database["public"]["Enums"]["registration_payment_method"]
            | null
          registration_id?: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          stripe_payment_intent_id?: string | null
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
          category_id: string | null
          consumed_at: string | null
          contact_email: string
          contact_email_normalized: string
          contact_phone: string
          contact_phone_normalized: string
          created_at: string
          display_name: string
          expires_at: string
          id: string
          participant_type: Database["public"]["Enums"]["participant_type"]
          payment_method: Database["public"]["Enums"]["registration_payment_method"]
          players: Json | null
          registration_id: string | null
          tournament_id: string
          verification_code_hash: string
          verification_token_hash: string
          verified_at: string | null
        }
        Insert: {
          category_id?: string | null
          consumed_at?: string | null
          contact_email: string
          contact_email_normalized: string
          contact_phone: string
          contact_phone_normalized: string
          created_at?: string
          display_name: string
          expires_at: string
          id?: string
          participant_type: Database["public"]["Enums"]["participant_type"]
          payment_method: Database["public"]["Enums"]["registration_payment_method"]
          players?: Json | null
          registration_id?: string | null
          tournament_id: string
          verification_code_hash: string
          verification_token_hash: string
          verified_at?: string | null
        }
        Update: {
          category_id?: string | null
          consumed_at?: string | null
          contact_email?: string
          contact_email_normalized?: string
          contact_phone?: string
          contact_phone_normalized?: string
          created_at?: string
          display_name?: string
          expires_at?: string
          id?: string
          participant_type?: Database["public"]["Enums"]["participant_type"]
          payment_method?: Database["public"]["Enums"]["registration_payment_method"]
          players?: Json | null
          registration_id?: string | null
          tournament_id?: string
          verification_code_hash?: string
          verification_token_hash?: string
          verified_at?: string | null
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
          cancel_code_hash: string | null
          cancel_token_hash: string | null
          cancelled_at: string | null
          category_id: string | null
          contact_email_normalized: string | null
          contact_phone_normalized: string | null
          created_at: string | null
          id: string
          participant_id: string
          payment_method:
            | Database["public"]["Enums"]["registration_payment_method"]
            | null
          public_reference: string | null
          status: Database["public"]["Enums"]["registration_status"] | null
          tournament_id: string
        }
        Insert: {
          cancel_code_hash?: string | null
          cancel_token_hash?: string | null
          cancelled_at?: string | null
          category_id?: string | null
          contact_email_normalized?: string | null
          contact_phone_normalized?: string | null
          created_at?: string | null
          id?: string
          participant_id: string
          payment_method?:
            | Database["public"]["Enums"]["registration_payment_method"]
            | null
          public_reference?: string | null
          status?: Database["public"]["Enums"]["registration_status"] | null
          tournament_id: string
        }
        Update: {
          cancel_code_hash?: string | null
          cancel_token_hash?: string | null
          cancelled_at?: string | null
          category_id?: string | null
          contact_email_normalized?: string | null
          contact_phone_normalized?: string | null
          created_at?: string | null
          id?: string
          participant_id?: string
          payment_method?:
            | Database["public"]["Enums"]["registration_payment_method"]
            | null
          public_reference?: string | null
          status?: Database["public"]["Enums"]["registration_status"] | null
          tournament_id?: string
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
          address: string | null
          created_at: string | null
          date: string | null
          description: string | null
          entry_price: number
          has_categories: boolean
          id: string
          is_public: boolean | null
          max_participants: number | null
          min_participants: number
          organizer_id: string
          payment_method:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          poster_url: string | null
          prize_mode: Database["public"]["Enums"]["prize_mode"]
          prizes: string | null
          province: string | null
          registration_deadline: string | null
          rules: string | null
          status: Database["public"]["Enums"]["tournament_status"] | null
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          entry_price?: number
          has_categories: boolean
          id?: string
          is_public?: boolean | null
          max_participants?: number | null
          min_participants?: number
          organizer_id: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          poster_url?: string | null
          prize_mode?: Database["public"]["Enums"]["prize_mode"]
          prizes?: string | null
          province?: string | null
          registration_deadline?: string | null
          rules?: string | null
          status?: Database["public"]["Enums"]["tournament_status"] | null
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          entry_price?: number
          has_categories?: boolean
          id?: string
          is_public?: boolean | null
          max_participants?: number | null
          min_participants?: number
          organizer_id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          poster_url?: string | null
          prize_mode?: Database["public"]["Enums"]["prize_mode"]
          prizes?: string | null
          province?: string | null
          registration_deadline?: string | null
          rules?: string | null
          status?: Database["public"]["Enums"]["tournament_status"] | null
          title?: string
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
          created_at: string | null
          email: string
          id: string
          name: string | null
          phone: string | null
          stripe_account_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          name?: string | null
          phone?: string | null
          stripe_account_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          phone?: string | null
          stripe_account_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_automatic_state_transitions: { Args: never; Returns: Json }
      approve_cash_registration: {
        Args: { p_registration_id: string }
        Returns: Json
      }
      cancel_public_registration: {
        Args: {
          p_cancel_code?: string
          p_cancel_token?: string
          p_public_reference: string
        }
        Returns: Json
      }
      cancel_registration_by_organizer: {
        Args: { p_registration_id: string }
        Returns: Json
      }
      cleanup_old_drafts: { Args: { days_old?: number }; Returns: number }
      create_and_publish_tournament: {
        Args: {
          p_address: string
          p_categories?: Json
          p_date: string
          p_description: string
          p_entry_price: number
          p_has_categories: boolean
          p_is_public: boolean
          p_max_participants: number
          p_min_participants: number
          p_payment_method: Database["public"]["Enums"]["payment_method_enum"]
          p_poster_url: string
          p_prize_mode: Database["public"]["Enums"]["prize_mode"]
          p_prizes: string
          p_province: string
          p_registration_deadline: string
          p_rules: string
          p_title: string
        }
        Returns: string
      }
      create_public_registration: {
        Args: {
          p_category_id?: string
          p_contact_email?: string
          p_contact_phone: string
          p_display_name: string
          p_participant_type: Database["public"]["Enums"]["participant_type"]
          p_payment_method?: Database["public"]["Enums"]["registration_payment_method"]
          p_players?: Json
          p_tournament_id: string
        }
        Returns: string
      }
      create_public_registration_request: {
        Args: {
          p_category_id?: string
          p_contact_email?: string
          p_contact_phone: string
          p_display_name: string
          p_participant_type: Database["public"]["Enums"]["participant_type"]
          p_payment_method?: Database["public"]["Enums"]["registration_payment_method"]
          p_players?: Json
          p_tournament_id: string
        }
        Returns: Json
      }
      generate_public_reference: { Args: never; Returns: string }
      mark_online_registration_paid: {
        Args: { p_registration_id: string }
        Returns: Json
      }
      normalize_email: { Args: { p_email: string }; Returns: string }
      normalize_phone: { Args: { p_phone: string }; Returns: string }
      publish_tournament: { Args: { p_tournament_id: string }; Returns: string }
      run_tournament_automation_job: { Args: never; Returns: Json }
      set_tournament_management_status: {
        Args: {
          p_next_status: Database["public"]["Enums"]["tournament_status"]
          p_tournament_id: string
        }
        Returns: string
      }
      sha256_hex: { Args: { p_value: string }; Returns: string }
      update_tournament_management_config: {
        Args: {
          p_address?: string
          p_date?: string
          p_description?: string
          p_is_public?: boolean
          p_province?: string
          p_registration_deadline?: string
          p_rules?: string
          p_title: string
          p_tournament_id: string
        }
        Returns: string
      }
      verify_public_registration_request: {
        Args: {
          p_request_id: string
          p_verification_code?: string
          p_verification_token?: string
        }
        Returns: Json
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
      tournament_status:
        | "draft"
        | "published"
        | "closed"
        | "finished"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
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
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
      tournament_status: [
        "draft",
        "published",
        "closed",
        "finished",
        "cancelled",
      ],
    },
  },
} as const
