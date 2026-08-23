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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      card_redemptions: {
        Row: {
          created_at: string
          id: string
          item_name: string
          order_id: string
          punches_spent: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          order_id: string
          punches_spent?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          order_id?: string
          punches_spent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          id: string
          items: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          items?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          items?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favourites: {
        Row: {
          created_at: string
          menu_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          menu_item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          menu_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourites_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          earns_punch: boolean
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          earns_punch?: boolean
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          earns_punch?: boolean
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          allergens: string[]
          base_price: number
          category_id: string
          created_at: string
          daily_stock: number | null
          description: string | null
          dietary_tags: string[]
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          modifiers: Json
          name: string
          slug: string
          sort_order: number
          unsplash_query: string | null
          updated_at: string
        }
        Insert: {
          allergens?: string[]
          base_price: number
          category_id: string
          created_at?: string
          daily_stock?: number | null
          description?: string | null
          dietary_tags?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          modifiers?: Json
          name: string
          slug: string
          sort_order?: number
          unsplash_query?: string | null
          updated_at?: string
        }
        Update: {
          allergens?: string[]
          base_price?: number
          category_id?: string
          created_at?: string
          daily_stock?: number | null
          description?: string | null
          dietary_tags?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          modifiers?: Json
          name?: string
          slug?: string
          sort_order?: number
          unsplash_query?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          base_price: number
          created_at: string
          earns_punch: boolean
          id: string
          item_name: string
          line_total: number
          menu_item_id: string | null
          order_id: string
          quantity: number
          selected_modifiers: Json
        }
        Insert: {
          base_price: number
          created_at?: string
          earns_punch?: boolean
          id?: string
          item_name: string
          line_total: number
          menu_item_id?: string | null
          order_id: string
          quantity?: number
          selected_modifiers?: Json
        }
        Update: {
          base_price?: number
          created_at?: string
          earns_punch?: boolean
          id?: string
          item_name?: string
          line_total?: number
          menu_item_id?: string | null
          order_id?: string
          quantity?: number
          selected_modifiers?: Json
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          access_token: string
          claimed_by: string | null
          collected_at: string | null
          customer_name: string | null
          expires_at: string | null
          id: string
          notes: string | null
          order_number: number
          payment_method: string
          pickup_at: string | null
          placed_at: string
          ready_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token?: string
          claimed_by?: string | null
          collected_at?: string | null
          customer_name?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          payment_method: string
          pickup_at?: string | null
          placed_at?: string
          ready_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string
          claimed_by?: string | null
          collected_at?: string | null
          customer_name?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          payment_method?: string
          pickup_at?: string | null
          placed_at?: string
          ready_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avoid_allergens: string[]
          bar_name: string | null
          created_at: string
          dietary_tags: string[]
          display_name: string | null
          id: string
          marketing_opt_in: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avoid_allergens?: string[]
          bar_name?: string | null
          created_at?: string
          dietary_tags?: string[]
          display_name?: string | null
          id: string
          marketing_opt_in?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avoid_allergens?: string[]
          bar_name?: string | null
          created_at?: string
          dietary_tags?: string[]
          display_name?: string | null
          id?: string
          marketing_opt_in?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string
          display_name: string
          failed_pins: number
          id: string
          is_active: boolean
          kind: string
          locked_until: string | null
          pin_hash: string | null
          role: Database["public"]["Enums"]["staff_role"]
          station: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          failed_pins?: number
          id?: string
          is_active?: boolean
          kind?: string
          locked_until?: string | null
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          station?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          failed_pins?: number
          id?: string
          is_active?: boolean
          kind?: string
          locked_until?: string | null
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          station?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      staff_events: {
        Row: {
          action: string
          created_at: string
          detail: Json
          id: number
          staff_id: string | null
          station_id: string | null
          subject_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          detail?: Json
          id?: never
          staff_id?: string | null
          station_id?: string | null
          subject_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          detail?: Json
          id?: never
          staff_id?: string | null
          station_id?: string | null
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_events_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      manage_bar: {
        Args: { p_actor: string; p_from: string; p_to: string }
        Returns: Json
      }
      manage_earnings: {
        Args: { p_actor: string; p_from: string; p_to: string }
        Returns: Json
      }
      manage_ledger: {
        Args: {
          p_actions?: string[]
          p_actor: string
          p_from: string
          p_limit?: number
          p_offset?: number
          p_staff?: string
          p_to: string
        }
        Returns: {
          action: string
          created_at: string
          detail: Json
          id: number
          item_name: string | null
          order_number: number | null
          staff_id: string | null
          staff_name: string | null
          station_name: string | null
          subject_id: string | null
        }[]
      }
      advance_order: {
        Args: {
          p_actor: string
          p_order_id: string
          p_station?: string
          p_to: Database["public"]["Enums"]["order_status"]
        }
        Returns: Json
      }
      cancel_order_by_token: { Args: { p_token: string }; Returns: Json }
      card_punches: { Args: { p_user: string }; Returns: number }
      claim_owner: { Args: { p_display_name: string }; Returns: string }
      create_order: {
        Args: {
          p_customer_name: string
          p_items: Json
          p_notes: string
          p_payment_method: string
          p_redeem_item_id?: string
          p_stripe_payment_intent_id?: string
          p_stripe_session_id?: string
          p_user_id?: string
        }
        Returns: {
          access_token: string
          claimed_by: string | null
          collected_at: string | null
          customer_name: string | null
          expires_at: string | null
          id: string
          notes: string | null
          order_number: number
          payment_method: string
          pickup_at: string | null
          placed_at: string
          ready_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_staff: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          failed_pins: number
          id: string
          is_active: boolean
          kind: string
          locked_until: string | null
          pin_hash: string | null
          role: Database["public"]["Enums"]["staff_role"]
          station: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "staff"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_card: { Args: never; Returns: Json }
      my_usual: { Args: never; Returns: Json }
      note_order: {
        Args: {
          p_actor: string
          p_note: string
          p_order_id: string
          p_station?: string
        }
        Returns: string
      }
      order_by_token: { Args: { p_token: string }; Returns: Json }
      order_lines: {
        Args: { p_items: Json; p_lock: boolean; p_redeem_item_id?: string }
        Returns: Json
      }
      order_transition_action: {
        Args: {
          p_from: Database["public"]["Enums"]["order_status"]
          p_to: Database["public"]["Enums"]["order_status"]
        }
        Returns: string
      }
      quote_order: {
        Args: { p_items: Json; p_redeem_item_id?: string }
        Returns: Json
      }
      release_expired_orders: { Args: never; Returns: number }
      release_order: { Args: { p_order_id: string }; Returns: boolean }
      set_item_stock: {
        Args: {
          p_actor: string
          p_item_id: string
          p_station?: string
          p_stock?: number
        }
        Returns: number
      }
      shift_mark: {
        Args: { p_open: boolean; p_staff_id: string; p_station?: string }
        Returns: string | null
      }
      staff_board: { Args: never; Returns: Json }
      staff_can: {
        Args: {
          p_action: string
          p_role: Database["public"]["Enums"]["staff_role"]
        }
        Returns: boolean
      }
      staff_order: { Args: { p_order_id: string }; Returns: Json }
      staff_shift: { Args: { p_staff_id: string }; Returns: string | null }
      staff_unlock: {
        Args: { p_pin: string; p_staff_id: string }
        Returns: Json
      }
    }
    Enums: {
      order_status:
        | "pending"
        | "paid"
        | "preparing"
        | "ready"
        | "collected"
        | "cancelled"
        | "refunded"
        | "abandoned"
      staff_role: "owner" | "manager" | "staff"
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
      order_status: [
        "pending",
        "paid",
        "preparing",
        "ready",
        "collected",
        "cancelled",
        "refunded",
        "abandoned",
      ],
      staff_role: ["owner", "manager", "staff"],
    },
  },
} as const
