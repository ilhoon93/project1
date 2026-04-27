/**
 * Database types for Supabase.
 *
 * Hand-typed for now to match supabase/migrations/001_initial.sql + 002_storage.sql.
 * Once the migrations are applied, regenerate with:
 *
 *   npx supabase gen types typescript --project-id <PROJECT_REF> --schema public > src/types/database.ts
 *
 * (The PROJECT_REF is the subdomain in your Supabase URL: https://<ref>.supabase.co)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          user_id: string;
          slug: string;
          is_published: boolean;
          published_at: string | null;
          expires_at: string | null;
          groom_name: string;
          bride_name: string;
          wedding_date: string | null;
          content: Json;
          total_price: number;
          paid_at: string | null;
          payment_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          slug: string;
          is_published?: boolean;
          published_at?: string | null;
          expires_at?: string | null;
          groom_name: string;
          bride_name: string;
          wedding_date?: string | null;
          content?: Json;
          total_price?: number;
          paid_at?: string | null;
          payment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          slug?: string;
          is_published?: boolean;
          published_at?: string | null;
          expires_at?: string | null;
          groom_name?: string;
          bride_name?: string;
          wedding_date?: string | null;
          content?: Json;
          total_price?: number;
          paid_at?: string | null;
          payment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      guest_visits: {
        Row: {
          id: string;
          invitation_id: string;
          visitor_name: string | null;
          visitor_side: 'groom' | 'bride' | null;
          device_type: string | null;
          duration_seconds: number | null;
          slides_viewed: Json;
          visited_at: string;
        };
        Insert: {
          id?: string;
          invitation_id: string;
          visitor_name?: string | null;
          visitor_side?: 'groom' | 'bride' | null;
          device_type?: string | null;
          duration_seconds?: number | null;
          slides_viewed?: Json;
          visited_at?: string;
        };
        Update: Partial<Database['public']['Tables']['guest_visits']['Insert']>;
        Relationships: [];
      };
      signatures: {
        Row: {
          id: string;
          invitation_id: string;
          visitor_name: string;
          visitor_side: 'groom' | 'bride' | null;
          signature_data: string | null;
          consent_personal_info: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          invitation_id: string;
          visitor_name: string;
          visitor_side?: 'groom' | 'bride' | null;
          signature_data?: string | null;
          consent_personal_info?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['signatures']['Insert']>;
        Relationships: [];
      };
      quiz_responses: {
        Row: {
          id: string;
          invitation_id: string;
          visitor_name: string | null;
          question_index: number;
          selected_option: number;
          is_correct: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invitation_id: string;
          visitor_name?: string | null;
          question_index: number;
          selected_option: number;
          is_correct?: boolean | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['quiz_responses']['Insert']>;
        Relationships: [];
      };
      vote_responses: {
        Row: {
          id: string;
          invitation_id: string;
          visitor_name: string | null;
          question_index: number;
          selected_option: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          invitation_id: string;
          visitor_name?: string | null;
          question_index: number;
          selected_option: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['vote_responses']['Insert']>;
        Relationships: [];
      };
      guestbook_messages: {
        Row: {
          id: string;
          invitation_id: string;
          visitor_name: string;
          message: string;
          consent_personal_info: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          invitation_id: string;
          visitor_name: string;
          message: string;
          consent_personal_info?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['guestbook_messages']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      publish_invitation: {
        Args: { inv_id: string };
        Returns: boolean;
      };
      invitation_is_active: {
        Args: { inv_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
