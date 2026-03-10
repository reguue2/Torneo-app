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
          city: string | null
          address: string | null
        }
        Insert: {
          id?: string
          tournament_id: string
          name: string
          price: number
          min_participants?: number
          max_participants?: number | null
          start_at?: string | null
          city?: string | null
          address?: string | null
        }
        Update: {
          id?: string
          tournament_id?: string
          name?: string
          price?: number
          min_participants?: number
          max_participants?: number | null
          start_at?: string | null
          city?: string | null
          address?: string | null
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

      registrations: {
        Row: {
          id: string
          category_id: string | null
          tournament_id: string | null
          participant_id: string
          status: Database["public"]["Enums"]["registration_status"] | null
          payment_method:
            | Database["public"]["Enums"]["registration_payment_method"]
            | null
          created_at: string | null
        }
        Insert: {
          id?: string
          category_id?: string | null
          tournament_id?: string | null
          participant_id: string
          status?: Database["public"]["Enums"]["registration_status"] | null
          payment_method?:
            | Database["public"]["Enums"]["registration_payment_method"]
            | null
          created_at?: string | null
        }
        Update: {
          id?: string
          category_id?: string | null
          tournament_id?: string | null
          participant_id?: string
          status?: Database["public"]["Enums"]["registration_status"] | null
          payment_method?:
            | Database["public"]["Enums"]["registration_payment_method"]
            | null
          created_at?: string | null
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

      payments: {
        Row: {
          id: string
          registration_id: string
          amount: number
          currency: string | null
          payment_method:
            | Database["public"]["Enums"]["registration_payment_method"]
            | null
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
          payment_method?:
            | Database["public"]["Enums"]["registration_payment_method"]
            | null
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
          payment_method?:
            | Database["public"]["Enums"]["registration_payment_method"]
            | null
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

      tournaments: {
        Row: {
          id: string
          organizer_id: string
          title: string
          description: string | null
          poster_url: string | null
          prizes: string | null
          rules: string | null
          city: string | null
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
        }
        Insert: {
          id?: string
          organizer_id: string
          title: string
          description?: string | null
          poster_url?: string | null
          prizes?: string | null
          rules?: string | null
          city?: string | null
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
        }
        Update: {
          id?: string
          organizer_id?: string
          title?: string
          description?: string | null
          poster_url?: string | null
          prizes?: string | null
          rules?: string | null
          city?: string | null
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

    Views: {
      [_ in never]: never
    }

    Functions: {
      [_ in never]: never
    }

    Enums: {
      participant_type: "individual" | "team"
      payment_method_enum: "cash" | "online" | "both"
      payment_status: "pending" | "paid" | "refunded"
      registration_payment_method: "cash" | "online"
      registration_status: "pending" | "paid" | "cancelled"
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends { Row: infer R }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
      registration_payment_method: ["cash", "online"],
      registration_status: ["pending", "paid", "cancelled"],
      tournament_status: ["draft", "published", "closed", "finished", "cancelled"],
    },
  },
} as const