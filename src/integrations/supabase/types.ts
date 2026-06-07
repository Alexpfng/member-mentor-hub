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
      assignments: {
        Row: {
          active: boolean | null
          created_at: string | null
          end_date: string | null
          id: string
          member_id: string
          program_id: string
          start_date: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          member_id: string
          program_id: string
          start_date?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          member_id?: string
          program_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      exercise_comments: {
        Row: {
          author_id: string
          author_role: string
          content: string
          created_at: string
          exercise_name: string
          id: string
          session_id: string
          video_id: string | null
        }
        Insert: {
          author_id: string
          author_role: string
          content: string
          created_at?: string
          exercise_name: string
          id?: string
          session_id: string
          video_id?: string | null
        }
        Update: {
          author_id?: string
          author_role?: string
          content?: string
          created_at?: string
          exercise_name?: string
          id?: string
          session_id?: string
          video_id?: string | null
        }
        Relationships: []
      }
      exercise_feedbacks: {
        Row: {
          block_id: string | null
          could_not_do: boolean | null
          created_at: string | null
          exercise_name: string | null
          felt_too_easy: boolean | null
          felt_too_hard: boolean | null
          id: string
          member_comment: string | null
          rpe: number | null
          session_id: string
        }
        Insert: {
          block_id?: string | null
          could_not_do?: boolean | null
          created_at?: string | null
          exercise_name?: string | null
          felt_too_easy?: boolean | null
          felt_too_hard?: boolean | null
          id?: string
          member_comment?: string | null
          rpe?: number | null
          session_id: string
        }
        Update: {
          block_id?: string | null
          could_not_do?: boolean | null
          created_at?: string | null
          exercise_name?: string | null
          felt_too_easy?: boolean | null
          felt_too_hard?: boolean | null
          id?: string
          member_comment?: string | null
          rpe?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_feedbacks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          category: string | null
          coach_notes: string | null
          color: string | null
          created_at: string | null
          created_by: string | null
          default_tempo: string | null
          description: string | null
          equipement: string | null
          id: string
          intensity_code: string | null
          is_archived: boolean | null
          is_global: boolean | null
          movement_patterns: string[]
          muscle_group: string | null
          muscles: string[] | null
          name: string
          requires_pelvis_cue: boolean | null
          starts_at_top: boolean | null
          youtube_id: string | null
          youtube_url: string | null
        }
        Insert: {
          category?: string | null
          coach_notes?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_tempo?: string | null
          description?: string | null
          equipement?: string | null
          id?: string
          intensity_code?: string | null
          is_archived?: boolean | null
          is_global?: boolean | null
          movement_patterns?: string[]
          muscle_group?: string | null
          muscles?: string[] | null
          name: string
          requires_pelvis_cue?: boolean | null
          starts_at_top?: boolean | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Update: {
          category?: string | null
          coach_notes?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          default_tempo?: string | null
          description?: string | null
          equipement?: string | null
          id?: string
          intensity_code?: string | null
          is_archived?: boolean | null
          is_global?: boolean | null
          movement_patterns?: string[]
          muscle_group?: string | null
          muscles?: string[] | null
          name?: string
          requires_pelvis_cue?: boolean | null
          starts_at_top?: boolean | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_intensity_code_fkey"
            columns: ["intensity_code"]
            isOneToOne: false
            referencedRelation: "intensity_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      free_activities: {
        Row: {
          category: string | null
          charge: string | null
          created_at: string
          distance_km: number | null
          duration_min: number | null
          elevation_m: number | null
          id: string
          name: string
          note: string | null
          order_index: number
          reps: string | null
          rpe: number | null
          series: number | null
          session_id: string
        }
        Insert: {
          category?: string | null
          charge?: string | null
          created_at?: string
          distance_km?: number | null
          duration_min?: number | null
          elevation_m?: number | null
          id?: string
          name: string
          note?: string | null
          order_index?: number
          reps?: string | null
          rpe?: number | null
          series?: number | null
          session_id: string
        }
        Update: {
          category?: string | null
          charge?: string | null
          created_at?: string
          distance_km?: number | null
          duration_min?: number | null
          elevation_m?: number | null
          id?: string
          name?: string
          note?: string | null
          order_index?: number
          reps?: string | null
          rpe?: number | null
          series?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_activities_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      glossary: {
        Row: {
          cle: string
          contenu: string
          created_at: string | null
          titre: string
        }
        Insert: {
          cle: string
          contenu: string
          created_at?: string | null
          titre: string
        }
        Update: {
          cle?: string
          contenu?: string
          created_at?: string | null
          titre?: string
        }
        Relationships: []
      }
      intensity_codes: {
        Row: {
          code: string
          color_hex: string
          created_at: string | null
          description: string
          label: string
        }
        Insert: {
          code: string
          color_hex: string
          created_at?: string | null
          description: string
          label: string
        }
        Update: {
          code?: string
          color_hex?: string
          created_at?: string | null
          description?: string
          label?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          id: string
          revoked_at: string | null
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          email?: string | null
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      member_notification_prefs: {
        Row: {
          coach_msg: boolean
          created_at: string
          logbook: boolean
          new_week: boolean
          planned_session: boolean
          pr: boolean
          streak: boolean
          updated_at: string
          user_id: string
          weight_reminder: boolean
          weight_reminder_dow: number
          weight_reminder_time: string
        }
        Insert: {
          coach_msg?: boolean
          created_at?: string
          logbook?: boolean
          new_week?: boolean
          planned_session?: boolean
          pr?: boolean
          streak?: boolean
          updated_at?: string
          user_id: string
          weight_reminder?: boolean
          weight_reminder_dow?: number
          weight_reminder_time?: string
        }
        Update: {
          coach_msg?: boolean
          created_at?: string
          logbook?: boolean
          new_week?: boolean
          planned_session?: boolean
          pr?: boolean
          streak?: boolean
          updated_at?: string
          user_id?: string
          weight_reminder?: boolean
          weight_reminder_dow?: number
          weight_reminder_time?: string
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          coach_private_notes: string | null
          goal: string | null
          height_cm: number | null
          id: string
          injuries: string | null
          level: string | null
          updated_at: string | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          coach_private_notes?: string | null
          goal?: string | null
          height_cm?: number | null
          id?: string
          injuries?: string | null
          level?: string | null
          updated_at?: string | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          coach_private_notes?: string | null
          goal?: string | null
          height_cm?: number | null
          id?: string
          injuries?: string | null
          level?: string | null
          updated_at?: string | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          from_id: string
          id: string
          pinned: boolean | null
          read: boolean | null
          to_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          from_id: string
          id?: string
          pinned?: boolean | null
          read?: boolean | null
          to_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          from_id?: string
          id?: string
          pinned?: boolean | null
          read?: boolean | null
          to_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_to_id_fkey"
            columns: ["to_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pain_reports: {
        Row: {
          comment: string | null
          created_at: string
          exercise_name: string
          id: string
          intensity: number
          member_id: string
          resolved_at: string | null
          resolved_by: string | null
          session_id: string | null
          updated_at: string
          zone: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          exercise_name: string
          id?: string
          intensity: number
          member_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          updated_at?: string
          zone: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          exercise_name?: string
          id?: string
          intensity?: number
          member_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          updated_at?: string
          zone?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          created_at: string | null
          date: string | null
          exercise_id: string | null
          exercise_name: string | null
          id: string
          member_id: string
          reps: number | null
          session_id: string | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          exercise_id?: string | null
          exercise_name?: string | null
          id?: string
          member_id: string
          reps?: number | null
          session_id?: string | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string | null
          exercise_id?: string | null
          exercise_name?: string | null
          id?: string
          member_id?: string
          reps?: number | null
          session_id?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_sessions: {
        Row: {
          created_at: string
          day_label: string
          id: string
          member_id: string
          planned_date: string | null
          program_id: string | null
          reminder_time: string | null
          session_id: string | null
          status: string
          updated_at: string
          week_number: number | null
        }
        Insert: {
          created_at?: string
          day_label: string
          id?: string
          member_id: string
          planned_date?: string | null
          program_id?: string | null
          reminder_time?: string | null
          session_id?: string | null
          status?: string
          updated_at?: string
          week_number?: number | null
        }
        Update: {
          created_at?: string
          day_label?: string
          id?: string
          member_id?: string
          planned_date?: string | null
          program_id?: string | null
          reminder_time?: string | null
          session_id?: string | null
          status?: string
          updated_at?: string
          week_number?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          coach_id: string
          created_at: string | null
          description: string | null
          duration_weeks: number | null
          frequency_per_week: number | null
          id: string
          level: string | null
          name: string
          objective: string | null
          structure: Json
          updated_at: string | null
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          description?: string | null
          duration_weeks?: number | null
          frequency_per_week?: number | null
          id?: string
          level?: string | null
          name: string
          objective?: string | null
          structure?: Json
          updated_at?: string | null
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          description?: string | null
          duration_weeks?: number | null
          frequency_per_week?: number | null
          id?: string
          level?: string | null
          name?: string
          objective?: string | null
          structure?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      running_routes: {
        Row: {
          coach_id: string
          created_at: string
          difficulty: string | null
          distance_km: number | null
          dminus_m: number | null
          dplus_m: number | null
          gpx_url: string | null
          id: string
          name: string
          points: Json
          short_id: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          difficulty?: string | null
          distance_km?: number | null
          dminus_m?: number | null
          dplus_m?: number | null
          gpx_url?: string | null
          id?: string
          name: string
          points?: Json
          short_id?: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          difficulty?: string | null
          distance_km?: number | null
          dminus_m?: number | null
          dplus_m?: number | null
          gpx_url?: string | null
          id?: string
          name?: string
          points?: Json
          short_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_media: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          member_id: string
          session_id: string
          storage_path: string
          thumbnail_path: string | null
          type: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          member_id: string
          session_id: string
          storage_path: string
          thumbnail_path?: string | null
          type: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          member_id?: string
          session_id?: string
          storage_path?: string
          thumbnail_path?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_media_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          average_rpe: number | null
          coach_note: string | null
          coach_seen: boolean
          created_at: string | null
          date: string | null
          day_number: number | null
          duration_minutes: number | null
          ended_at: string | null
          free_category: string | null
          free_title: string | null
          id: string
          member_id: string
          member_note: string | null
          overall_feeling: number | null
          program_id: string | null
          session_label: string | null
          session_type: string
          started_at: string | null
          status: string | null
          total_volume_kg: number | null
          week_number: number | null
        }
        Insert: {
          average_rpe?: number | null
          coach_note?: string | null
          coach_seen?: boolean
          created_at?: string | null
          date?: string | null
          day_number?: number | null
          duration_minutes?: number | null
          ended_at?: string | null
          free_category?: string | null
          free_title?: string | null
          id?: string
          member_id: string
          member_note?: string | null
          overall_feeling?: number | null
          program_id?: string | null
          session_label?: string | null
          session_type?: string
          started_at?: string | null
          status?: string | null
          total_volume_kg?: number | null
          week_number?: number | null
        }
        Update: {
          average_rpe?: number | null
          coach_note?: string | null
          coach_seen?: boolean
          created_at?: string | null
          date?: string | null
          day_number?: number | null
          duration_minutes?: number | null
          ended_at?: string | null
          free_category?: string | null
          free_title?: string | null
          id?: string
          member_id?: string
          member_note?: string | null
          overall_feeling?: number | null
          program_id?: string | null
          session_label?: string | null
          session_type?: string
          started_at?: string | null
          status?: string | null
          total_volume_kg?: number | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      set_logs: {
        Row: {
          completed: boolean | null
          distance_m: number | null
          duration_seconds: number | null
          exercise_id: string | null
          exercise_name: string | null
          id: string
          logged_at: string | null
          note: string | null
          reps: number | null
          rpe: number | null
          session_id: string
          set_number: number | null
          weight_kg: number | null
        }
        Insert: {
          completed?: boolean | null
          distance_m?: number | null
          duration_seconds?: number | null
          exercise_id?: string | null
          exercise_name?: string | null
          id?: string
          logged_at?: string | null
          note?: string | null
          reps?: number | null
          rpe?: number | null
          session_id: string
          set_number?: number | null
          weight_kg?: number | null
        }
        Update: {
          completed?: boolean | null
          distance_m?: number | null
          duration_seconds?: number | null
          exercise_id?: string | null
          exercise_name?: string | null
          id?: string
          logged_at?: string | null
          note?: string | null
          reps?: number | null
          rpe?: number | null
          session_id?: string
          set_number?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "set_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      technique_videos: {
        Row: {
          coach_feedback: string | null
          coach_reviewed: boolean | null
          created_at: string | null
          exercise_name: string | null
          id: string
          member_id: string
          public_url: string | null
          reviewed_at: string | null
          session_id: string | null
          storage_path: string | null
          thumbnail_url: string | null
          unread_for_member: boolean | null
        }
        Insert: {
          coach_feedback?: string | null
          coach_reviewed?: boolean | null
          created_at?: string | null
          exercise_name?: string | null
          id?: string
          member_id: string
          public_url?: string | null
          reviewed_at?: string | null
          session_id?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          unread_for_member?: boolean | null
        }
        Update: {
          coach_feedback?: string | null
          coach_reviewed?: boolean | null
          created_at?: string | null
          exercise_name?: string | null
          id?: string
          member_id?: string
          public_url?: string | null
          reviewed_at?: string | null
          session_id?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          unread_for_member?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "technique_videos_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technique_videos_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_logbooks: {
        Row: {
          avg_rpe: number | null
          coach_message: string | null
          feelings: Json | null
          generated_at: string
          id: string
          member_id: string
          new_prs: Json | null
          pain_summary: string | null
          period_end: string
          period_start: string
          program_id: string | null
          sessions_done: number | null
          sessions_planned: number | null
          total_duration_min: number | null
          total_volume_kg: number | null
          updated_at: string
          week_number: number
          weight_end: number | null
          weight_start: number | null
        }
        Insert: {
          avg_rpe?: number | null
          coach_message?: string | null
          feelings?: Json | null
          generated_at?: string
          id?: string
          member_id: string
          new_prs?: Json | null
          pain_summary?: string | null
          period_end: string
          period_start: string
          program_id?: string | null
          sessions_done?: number | null
          sessions_planned?: number | null
          total_duration_min?: number | null
          total_volume_kg?: number | null
          updated_at?: string
          week_number: number
          weight_end?: number | null
          weight_start?: number | null
        }
        Update: {
          avg_rpe?: number | null
          coach_message?: string | null
          feelings?: Json | null
          generated_at?: string
          id?: string
          member_id?: string
          new_prs?: Json | null
          pain_summary?: string | null
          period_end?: string
          period_start?: string
          program_id?: string | null
          sessions_done?: number | null
          sessions_planned?: number | null
          total_duration_min?: number | null
          total_volume_kg?: number | null
          updated_at?: string
          week_number?: number
          weight_end?: number | null
          weight_start?: number | null
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          created_at: string | null
          date: string
          id: string
          member_id: string
          note: string | null
          weight_kg: number
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          member_id: string
          note?: string | null
          weight_kg: number
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          member_id?: string
          note?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_invitation: {
        Args: { _token: string; _user_id: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      validate_invitation: {
        Args: { _token: string }
        Returns: {
          email: string
          reason: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "coach" | "member"
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
      app_role: ["coach", "member"],
    },
  },
} as const
