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
      archetypes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          signature_axes: Json
          signature_signals: string[]
          tagline: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          signature_axes?: Json
          signature_signals?: string[]
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          signature_axes?: Json
          signature_signals?: string[]
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      choices: {
        Row: {
          chosen_song_id: string
          created_at: string
          id: string
          ms_to_decide: number | null
          pairing_id: string
          session_id: string
        }
        Insert: {
          chosen_song_id: string
          created_at?: string
          id?: string
          ms_to_decide?: number | null
          pairing_id: string
          session_id: string
        }
        Update: {
          chosen_song_id?: string
          created_at?: string
          id?: string
          ms_to_decide?: number | null
          pairing_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "choices_chosen_song_id_fkey"
            columns: ["chosen_song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "choices_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "pairings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "choices_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pairings: {
        Row: {
          active: boolean
          created_at: string
          diagnostic_weight: number
          hypothesis: string | null
          id: string
          song_a_id: string
          song_b_id: string
          tests: string[]
          updated_at: string
          why_good: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          diagnostic_weight?: number
          hypothesis?: string | null
          id?: string
          song_a_id: string
          song_b_id: string
          tests?: string[]
          updated_at?: string
          why_good?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          diagnostic_weight?: number
          hypothesis?: string | null
          id?: string
          song_a_id?: string
          song_b_id?: string
          tests?: string[]
          updated_at?: string
          why_good?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pairings_song_a_id_fkey"
            columns: ["song_a_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pairings_song_b_id_fkey"
            columns: ["song_b_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          opening_hypothesis: string | null
          opening_songs: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          opening_hypothesis?: string | null
          opening_songs?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          opening_hypothesis?: string | null
          opening_songs?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          archetype_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          interpretation: string | null
          started_at: string
          updated_at: string
          user_id: string
          vector: Json
        }
        Insert: {
          archetype_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          interpretation?: string | null
          started_at?: string
          updated_at?: string
          user_id: string
          vector?: Json
        }
        Update: {
          archetype_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          interpretation?: string | null
          started_at?: string
          updated_at?: string
          user_id?: string
          vector?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sessions_archetype_id_fkey"
            columns: ["archetype_id"]
            isOneToOne: false
            referencedRelation: "archetypes"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          active: boolean
          archetype_signals: string[]
          artist: string
          atmosphere: number
          authenticity: number
          community: number
          complexity: number
          created_at: string
          darkness: number
          diagnostic_power: number
          dreaminess: number
          energy: number
          groove: number
          hope: number
          id: string
          lane: string
          melody: number
          movement: number
          nostalgia: number
          primary_dimensions: string[]
          romanticism: number
          title: string
          transformation: number
          updated_at: string
          verbal_cleverness: number
          year: number | null
        }
        Insert: {
          active?: boolean
          archetype_signals?: string[]
          artist: string
          atmosphere?: number
          authenticity?: number
          community?: number
          complexity?: number
          created_at?: string
          darkness?: number
          diagnostic_power?: number
          dreaminess?: number
          energy?: number
          groove?: number
          hope?: number
          id?: string
          lane: string
          melody?: number
          movement?: number
          nostalgia?: number
          primary_dimensions?: string[]
          romanticism?: number
          title: string
          transformation?: number
          updated_at?: string
          verbal_cleverness?: number
          year?: number | null
        }
        Update: {
          active?: boolean
          archetype_signals?: string[]
          artist?: string
          atmosphere?: number
          authenticity?: number
          community?: number
          complexity?: number
          created_at?: string
          darkness?: number
          diagnostic_power?: number
          dreaminess?: number
          energy?: number
          groove?: number
          hope?: number
          id?: string
          lane?: string
          melody?: number
          movement?: number
          nostalgia?: number
          primary_dimensions?: string[]
          romanticism?: number
          title?: string
          transformation?: number
          updated_at?: string
          verbal_cleverness?: number
          year?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
