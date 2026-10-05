// Generated from the Supabase schema. Regenerate after every migration.
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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          opening_balance: number
          type: Database["public"]["Enums"]["account_type"]
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          opening_balance?: number
          type?: Database["public"]["Enums"]["account_type"]
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          opening_balance?: number
          type?: Database["public"]["Enums"]["account_type"]
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          active_from: string
          active_to: string | null
          category_id: string | null
          created_at: string
          id: string
          limit_amount: number
          period: Database["public"]["Enums"]["budget_period"]
          scope: Database["public"]["Enums"]["budget_scope"]
          user_id: string
        }
        Insert: {
          active_from?: string
          active_to?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          limit_amount: number
          period?: Database["public"]["Enums"]["budget_period"]
          scope: Database["public"]["Enums"]["budget_scope"]
          user_id?: string
        }
        Update: {
          active_from?: string
          active_to?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          limit_amount?: number
          period?: Database["public"]["Enums"]["budget_period"]
          scope?: Database["public"]["Enums"]["budget_scope"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_user_id_fkey"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      buy_intents: {
        Row: {
          category_id: string | null
          cooldown_until: string
          created_at: string
          decided_at: string | null
          estimated_cost: number
          id: string
          item_name: string
          necessity: Database["public"]["Enums"]["necessity_level"]
          status: Database["public"]["Enums"]["intent_status"]
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          category_id?: string | null
          cooldown_until?: string
          created_at?: string
          decided_at?: string | null
          estimated_cost: number
          id?: string
          item_name: string
          necessity: Database["public"]["Enums"]["necessity_level"]
          status?: Database["public"]["Enums"]["intent_status"]
          transaction_id?: string | null
          user_id?: string
        }
        Update: {
          category_id?: string | null
          cooldown_until?: string
          created_at?: string
          decided_at?: string | null
          estimated_cost?: number
          id?: string
          item_name?: string
          necessity?: Database["public"]["Enums"]["necessity_level"]
          status?: Database["public"]["Enums"]["intent_status"]
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_intents_category_id_user_id_fkey"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "buy_intents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      debt_payments: {
        Row: {
          amount: number
          debt_id: string
          id: string
          paid_at: string
          user_id: string
        }
        Insert: {
          amount: number
          debt_id: string
          id?: string
          paid_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          debt_id?: string
          id?: string
          paid_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_user_id_fkey"
            columns: ["debt_id", "user_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "debt_payments_debt_id_user_id_fkey"
            columns: ["debt_id", "user_id"]
            isOneToOne: false
            referencedRelation: "v_debts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      debts: {
        Row: {
          amount: number
          created_at: string
          direction: Database["public"]["Enums"]["debt_direction"]
          due_date: string | null
          id: string
          note: string | null
          person: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          direction: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          id?: string
          note?: string | null
          person: string
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          direction?: Database["public"]["Enums"]["debt_direction"]
          due_date?: string | null
          id?: string
          note?: string | null
          person?: string
          user_id?: string
        }
        Relationships: []
      }
      goal_contributions: {
        Row: {
          amount: number
          created_at: string
          goal_id: string
          id: string
          intent_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          goal_id: string
          id?: string
          intent_id?: string | null
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          goal_id?: string
          id?: string
          intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_goal_id_user_id_fkey"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "goal_contributions_goal_id_user_id_fkey"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "v_goal_progress"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "goal_contributions_intent_id_user_id_fkey"
            columns: ["intent_id", "user_id"]
            isOneToOne: false
            referencedRelation: "buy_intents"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "goal_contributions_intent_id_user_id_fkey"
            columns: ["intent_id", "user_id"]
            isOneToOne: false
            referencedRelation: "v_buy_intents"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          timezone: string
        }
        Insert: {
          created_at?: string
          id: string
          timezone?: string
        }
        Update: {
          created_at?: string
          id?: string
          timezone?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          created_at: string
          id: string
          ocr_json: Json
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ocr_json?: Json
          storage_path: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          ocr_json?: Json
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          account_id: string
          active: boolean
          amount: number
          category_id: string | null
          created_at: string
          day_of_month: number
          id: string
          name: string
          necessity: Database["public"]["Enums"]["necessity_level"] | null
          next_due: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          account_id: string
          active?: boolean
          amount: number
          category_id?: string | null
          created_at?: string
          day_of_month: number
          id?: string
          name: string
          necessity?: Database["public"]["Enums"]["necessity_level"] | null
          next_due?: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Update: {
          account_id?: string
          active?: boolean
          amount?: number
          category_id?: string | null
          created_at?: string
          day_of_month?: number
          id?: string
          name?: string
          necessity?: Database["public"]["Enums"]["necessity_level"] | null
          next_due?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_user_id_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "recurring_transactions_account_id_user_id_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id", "user_id"]
          },
          {
            foreignKeyName: "recurring_transactions_category_id_user_id_fkey"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          created_at: string
          deadline: string | null
          id: string
          name: string
          target_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          id?: string
          name: string
          target_amount: number
          user_id?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          id?: string
          name?: string
          target_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          description: string | null
          from_account_id: string | null
          id: string
          merchant: string | null
          necessity: Database["public"]["Enums"]["necessity_level"] | null
          needs_review: boolean | null
          occurred_at: string
          receipt_id: string | null
          recurring_id: string | null
          regret: boolean | null
          regret_reviewed_at: string | null
          to_account_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          from_account_id?: string | null
          id?: string
          merchant?: string | null
          necessity?: Database["public"]["Enums"]["necessity_level"] | null
          needs_review?: boolean | null
          occurred_at?: string
          receipt_id?: string | null
          recurring_id?: string | null
          regret?: boolean | null
          regret_reviewed_at?: string | null
          to_account_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          from_account_id?: string | null
          id?: string
          merchant?: string | null
          necessity?: Database["public"]["Enums"]["necessity_level"] | null
          needs_review?: boolean | null
          occurred_at?: string
          receipt_id?: string | null
          recurring_id?: string | null
          regret?: boolean | null
          regret_reviewed_at?: string | null
          to_account_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_user_id_fkey"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_from_account_id_user_id_fkey"
            columns: ["from_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_from_account_id_user_id_fkey"
            columns: ["from_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id", "user_id"]
          },
          {
            foreignKeyName: "transactions_receipt_id_user_id_fkey"
            columns: ["receipt_id", "user_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_user_id_fkey"
            columns: ["to_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_user_id_fkey"
            columns: ["to_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["account_id", "user_id"]
          },
        ]
      }
    }
    Views: {
      v_account_balances: {
        Row: {
          account_id: string | null
          archived_at: string | null
          current_balance: number | null
          name: string | null
          type: Database["public"]["Enums"]["account_type"] | null
          user_id: string | null
        }
        Relationships: []
      }
      v_budget_remaining: {
        Row: {
          budget_id: string | null
          category_id: string | null
          limit_amount: number | null
          period: Database["public"]["Enums"]["budget_period"] | null
          period_end: string | null
          period_start: string | null
          remaining: number | null
          scope: Database["public"]["Enums"]["budget_scope"] | null
          spent: number | null
          unreviewed_amount: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_user_id_fkey"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      v_buy_intents: {
        Row: {
          category_id: string | null
          cooldown_until: string | null
          created_at: string | null
          decided_at: string | null
          effective_status: string | null
          estimated_cost: number | null
          id: string | null
          item_name: string | null
          necessity: Database["public"]["Enums"]["necessity_level"] | null
          status: Database["public"]["Enums"]["intent_status"] | null
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          category_id?: string | null
          cooldown_until?: string | null
          created_at?: string | null
          decided_at?: string | null
          effective_status?: never
          estimated_cost?: number | null
          id?: string | null
          item_name?: string | null
          necessity?: Database["public"]["Enums"]["necessity_level"] | null
          status?: Database["public"]["Enums"]["intent_status"] | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          category_id?: string | null
          cooldown_until?: string | null
          created_at?: string | null
          decided_at?: string | null
          effective_status?: never
          estimated_cost?: number | null
          id?: string | null
          item_name?: string | null
          necessity?: Database["public"]["Enums"]["necessity_level"] | null
          status?: Database["public"]["Enums"]["intent_status"] | null
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buy_intents_category_id_user_id_fkey"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "buy_intents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_debts: {
        Row: {
          amount: number | null
          created_at: string | null
          direction: Database["public"]["Enums"]["debt_direction"] | null
          due_date: string | null
          id: string | null
          last_paid_at: string | null
          note: string | null
          paid: number | null
          person: string | null
          remaining: number | null
          settled: boolean | null
          user_id: string | null
        }
        Relationships: []
      }
      v_goal_progress: {
        Row: {
          created_at: string | null
          deadline: string | null
          id: string | null
          name: string | null
          saved: number | null
          target_amount: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_regret_by_necessity: {
        Row: {
          necessity: Database["public"]["Enums"]["necessity_level"] | null
          regretted: number | null
          regretted_amount: number | null
          reviewed: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_saved_money_monthly: {
        Row: {
          items_held_back: number | null
          month: string | null
          total_held_back: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_spending_mix_monthly: {
        Row: {
          month: string | null
          necessity: string | null
          total: number | null
          tx_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_my_account: { Args: never; Returns: undefined }
      intent_cooldown: {
        Args: { p_cost: number; p_user_id: string }
        Returns: string
      }
      post_due_recurring: { Args: never; Returns: number }
      purchase_intent: {
        Args: { p_account_id: string; p_amount?: number; p_intent_id: string }
        Returns: string
      }
      recurring_due_date: {
        Args: { p_day: number; p_month: number; p_year: number }
        Returns: string
      }
      user_today: { Args: { p_user_id: string }; Returns: string }
    }
    Enums: {
      account_type: "BANK" | "EWALLET" | "CASH"
      budget_period: "WEEKLY" | "MONTHLY"
      budget_scope: "CATEGORY" | "ESSENTIAL" | "DISCRETIONARY"
      category_kind: "EXPENSE" | "INCOME"
      debt_direction: "OWED_TO_ME" | "I_OWE"
      intent_status: "PENDING" | "PURCHASED" | "CANCELLED"
      necessity_level: "NEED" | "IMPORTANT" | "WANT" | "IMPULSE"
      transaction_type: "INCOME" | "EXPENSE" | "TRANSFER"
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

export const Constants = {
  public: {
    Enums: {
      account_type: ["BANK", "EWALLET", "CASH"],
      budget_period: ["WEEKLY", "MONTHLY"],
      budget_scope: ["CATEGORY", "ESSENTIAL", "DISCRETIONARY"],
      category_kind: ["EXPENSE", "INCOME"],
      debt_direction: ["OWED_TO_ME", "I_OWE"],
      intent_status: ["PENDING", "PURCHASED", "CANCELLED"],
      necessity_level: ["NEED", "IMPORTANT", "WANT", "IMPULSE"],
      transaction_type: ["INCOME", "EXPENSE", "TRANSFER"],
    },
  },
} as const
