export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {

  __InternalSupabase: {
    PostgrestVersion: "14.5"
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
          vat_rate: number
        }
        Insert: {
          created_at?: string
          earns_punch?: boolean
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          earns_punch?: boolean
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          vat_rate?: number
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
          par_stock: number | null
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
          par_stock?: number | null
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
          par_stock?: number | null
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
          vat_rate: number
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
          vat_rate?: number
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
          vat_rate?: number
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
      order_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          order_id: string
          p256dh: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          order_id: string
          p256dh: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          order_id?: string
          p256dh?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_push_subscriptions_order_id_fkey"
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
          day_number: number | null
          discount_reason: string | null
          discount_total: number
          expires_at: string | null
          id: string
          notes: string | null
          order_number: number
          payment_method: string
          pickup_at: string | null
          placed_at: string
          ready_at: string | null
          receipt_email: string | null
          receipt_sent_at: string | null
          service_day: string | null
          settled_as: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token?: string
          claimed_by?: string | null
          collected_at?: string | null
          customer_name?: string | null
          day_number?: number | null
          discount_reason?: string | null
          discount_total?: number
          expires_at?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          payment_method: string
          pickup_at?: string | null
          placed_at?: string
          ready_at?: string | null
          receipt_email?: string | null
          receipt_sent_at?: string | null
          service_day?: string | null
          settled_as?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string
          claimed_by?: string | null
          collected_at?: string | null
          customer_name?: string | null
          day_number?: number | null
          discount_reason?: string | null
          discount_total?: number
          expires_at?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          payment_method?: string
          pickup_at?: string | null
          placed_at?: string
          ready_at?: string | null
          receipt_email?: string | null
          receipt_sent_at?: string | null
          service_day?: string | null
          settled_as?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          tax_total?: number
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
          {
            foreignKeyName: "orders_service_day_fkey"
            columns: ["service_day"]
            isOneToOne: false
            referencedRelation: "service_days"
            referencedColumns: ["day"]
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
      service_days: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          count_detail: Json | null
          counted_cash: number | null
          day: string
          float_cash: number
          next_number: number
          opened_at: string
          opened_by: string | null
          report: Json | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          count_detail?: Json | null
          counted_cash?: number | null
          day: string
          float_cash?: number
          next_number?: number
          opened_at?: string
          opened_by?: string | null
          report?: Json | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          count_detail?: Json | null
          counted_cash?: number | null
          day?: string
          float_cash?: number
          next_number?: number
          opened_at?: string
          opened_by?: string | null
          report?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "service_days_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_days_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
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
      advance_order: {
        Args: {
          p_actor: string
          p_order_id: string
          p_station?: string
          p_tender?: string
          p_to: Database["public"]["Enums"]["order_status"]
        }
        Returns: Json
      }
      cancel_order_by_token: { Args: { p_token: string }; Returns: Json }
      card_punches: { Args: { p_user: string }; Returns: number }
      claim_owner: { Args: { p_display_name: string }; Returns: string }
      close_service: {
        Args: { p_actor: string; p_counted: number; p_detail?: Json }
        Returns: Json
      }
      create_order: {
        Args: {
          p_customer_name: string
          p_items: Json
          p_notes: string
          p_payment_method: string
          p_receipt_email?: string
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
          day_number: number | null
          discount_reason: string | null
          discount_total: number
          expires_at: string | null
          id: string
          notes: string | null
          order_number: number
          payment_method: string
          pickup_at: string | null
          placed_at: string
          ready_at: string | null
          receipt_email: string | null
          receipt_sent_at: string | null
          service_day: string | null
          settled_as: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number
          tax_total: number
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
      current_service_day: { Args: never; Returns: string }
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
      discount_order: {
        Args: {
          p_actor: string
          p_kind: string
          p_order_id: string
          p_reason: string
          p_station?: string
          p_value: number
        }
        Returns: Json
      }
      is_staff: { Args: never; Returns: boolean }
      manage_bar: {
        Args: { p_actor: string; p_from: string; p_to: string }
        Returns: Json
      }
      manage_earnings: {
        Args: { p_actor: string; p_from: string; p_to: string }
        Returns: Json
      }
      manage_guard: { Args: { p_actor: string }; Returns: undefined }
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
          item_name: string
          order_number: number
          staff_id: string
          staff_name: string
          station_name: string
          subject_id: string
        }[]
      }
      menu_category_upsert: {
        Args: { p_actor: string; p_category: Json }
        Returns: {
          created_at: string
          earns_punch: boolean
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          vat_rate: number
        }
        SetofOptions: {
          from: "*"
          to: "menu_categories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      menu_item_delete: {
        Args: { p_actor: string; p_id: string }
        Returns: undefined
      }
      menu_reorder: {
        Args: { p_actor: string; p_ids: string[] }
        Returns: number
      }
      menu_slug: { Args: { p_name: string }; Returns: string }
      menu_upsert: {
        Args: { p_actor: string; p_item: Json }
        Returns: {
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
          par_stock: number | null
          slug: string
          sort_order: number
          unsplash_query: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "menu_items"
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
      open_service: {
        Args: { p_actor: string; p_stock?: Json }
        Returns: {
          closed_at: string | null
          closed_by: string | null
          count_detail: Json | null
          counted_cash: number | null
          day: string
          float_cash: number
          next_number: number
          opened_at: string
          opened_by: string | null
          report: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "service_days"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      order_by_token: { Args: { p_token: string }; Returns: Json }
      order_lines: {
        Args: { p_items: Json; p_lock: boolean; p_redeem_item_id?: string }
        Returns: Json
      }
      order_receipt: { Args: { p_token: string }; Returns: Json }
      order_transition_action: {
        Args: {
          p_from: Database["public"]["Enums"]["order_status"]
          p_to: Database["public"]["Enums"]["order_status"]
        }
        Returns: string
      }
      order_was_paid: {
        Args: { p_status: Database["public"]["Enums"]["order_status"] }
        Returns: boolean
      }
      quote_order: {
        Args: { p_items: Json; p_redeem_item_id?: string }
        Returns: Json
      }
      release_expired_orders: { Args: never; Returns: number }
      release_order: { Args: { p_order_id: string }; Returns: boolean }
      service_report: {
        Args: { p_actor: string; p_day: string }
        Returns: Json
      }
      set_item_stock: {
        Args: {
          p_actor: string
          p_item_id: string
          p_station?: string
          p_stock?: number
        }
        Returns: number
      }
      set_receipt_email: {
        Args: { p_email: string; p_token: string }
        Returns: boolean
      }
      shift_mark: {
        Args: { p_open: boolean; p_staff_id: string; p_station?: string }
        Returns: string
      }
      shop_tz: { Args: never; Returns: string }
      staff_board: { Args: never; Returns: Json }
      staff_can: {
        Args: {
          p_action: string
          p_role: Database["public"]["Enums"]["staff_role"]
        }
        Returns: boolean
      }
      staff_order: { Args: { p_order_id: string }; Returns: Json }
      staff_role_now: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      staff_shift: { Args: { p_staff_id: string }; Returns: string }
      staff_unlock: {
        Args: { p_pin: string; p_staff_id: string }
        Returns: Json
      }
      subscribe_order_push: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_token: string
        }
        Returns: boolean
      }
      valid_modifiers: { Args: { p_modifiers: Json }; Returns: boolean }
      vat_of: { Args: { p_gross: number; p_rate: number }; Returns: number }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
