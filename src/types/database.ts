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
      addon_packages: {
        Row: {
          code: string;
          name: string;
          description: string | null;
          price: number;
          publish_credits_grant: number;
          naver_smartstore_product_no: string | null;
          active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          code: string;
          name: string;
          description?: string | null;
          price: number;
          publish_credits_grant?: number;
          naver_smartstore_product_no?: string | null;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['addon_packages']['Insert']>;
        Relationships: [];
      };
      purchase_orders: {
        Row: {
          id: string;
          user_id: string;
          source: 'portone' | 'naver_smartstore' | 'manual';
          package_code: string | null;
          portone_payment_id: string | null;
          naver_order_no: string | null;
          naver_product_order_no: string | null;
          amount: number;
          granted_credits: number;
          raw_data: Json;
          status: 'pending' | 'completed' | 'failed' | 'refunded';
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          source: 'portone' | 'naver_smartstore' | 'manual';
          package_code?: string | null;
          portone_payment_id?: string | null;
          naver_order_no?: string | null;
          naver_product_order_no?: string | null;
          amount?: number;
          granted_credits?: number;
          raw_data?: Json;
          status?: 'pending' | 'completed' | 'failed' | 'refunded';
          created_at?: string;
          processed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['purchase_orders']['Insert']>;
        Relationships: [];
      };
      publish_credits_ledger: {
        Row: {
          id: string;
          user_id: string;
          delta: number;
          reason: 'purchase' | 'publish' | 'admin_grant' | 'admin_revoke' | 'refund';
          ref_table: string | null;
          ref_id: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          delta: number;
          reason: 'purchase' | 'publish' | 'admin_grant' | 'admin_revoke' | 'refund';
          ref_table?: string | null;
          ref_id?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['publish_credits_ledger']['Insert']>;
        Relationships: [];
      };
      publications: {
        Row: {
          id: string;
          invitation_id: string;
          user_id: string;
          slug: string;
          groom_name: string;
          bride_name: string;
          wedding_date: string | null;
          content: Json;
          published_at: string;
          expires_at: string;
          revoked_at: string | null;
          credit_ledger_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invitation_id: string;
          user_id: string;
          slug: string;
          groom_name: string;
          bride_name: string;
          wedding_date?: string | null;
          content?: Json;
          published_at?: string;
          expires_at: string;
          revoked_at?: string | null;
          credit_ledger_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['publications']['Insert']>;
        Relationships: [];
      };
      naver_accounts: {
        Row: {
          user_id: string;
          naver_id: string;
          email: string | null;
          nickname: string | null;
          access_token: string | null;
          refresh_token: string | null;
          token_expires_at: string | null;
          scope: string | null;
          raw_profile: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          naver_id: string;
          email?: string | null;
          nickname?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          scope?: string | null;
          raw_profile?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['naver_accounts']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      publish_invitation: {
        Args: { inv_id: string };
        Returns: boolean;
      };
      publish_invitation_v2: {
        Args: { inv_id: string; new_slug: string };
        Returns: Json;
      };
      publish_credits_balance: {
        Args: { uid: string };
        Returns: number;
      };
      grant_purchase_credits: {
        Args: {
          p_user_id: string;
          p_source: string;
          p_package_code: string;
          p_amount: number;
          p_portone_payment?: string | null;
          p_naver_order_no?: string | null;
          p_naver_product_no?: string | null;
          p_raw?: Json;
        };
        Returns: Json;
      };
      invitation_is_active: {
        Args: { inv_id: string };
        Returns: boolean;
      };
      cleanup_stale_drafts: {
        Args: { ttl_days?: number };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
