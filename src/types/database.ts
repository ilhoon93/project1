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
      snap_credits_ledger: {
        Row: {
          id: string;
          user_id: string;
          delta: number;
          reason:
            | 'purchase'
            | 'consume'
            | 'refund'
            | 'legacy_migration'
            | 'admin_grant'
            | 'admin_revoke'
            | 'welcome';
          ref_table: string | null;
          ref_id: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          delta: number;
          reason:
            | 'purchase'
            | 'consume'
            | 'refund'
            | 'legacy_migration'
            | 'admin_grant'
            | 'admin_revoke'
            | 'welcome';
          ref_table?: string | null;
          ref_id?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['snap_credits_ledger']['Insert']>;
        Relationships: [];
      };
      snap_anchors: {
        Row: {
          user_id: string;
          groom_anchor_url: string | null;
          bride_anchor_url: string | null;
          groom_selfie_url: string | null;
          bride_selfie_url: string | null;
          source_mode: 'selfies' | 'couple';
          groom_height_cm: number | null;
          groom_weight_kg: number | null;
          bride_height_cm: number | null;
          bride_weight_kg: number | null;
          last_batch_at: string | null;
          free_full_batches_used: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          groom_anchor_url?: string | null;
          bride_anchor_url?: string | null;
          groom_selfie_url?: string | null;
          bride_selfie_url?: string | null;
          source_mode: 'selfies' | 'couple';
          groom_height_cm?: number | null;
          groom_weight_kg?: number | null;
          bride_height_cm?: number | null;
          bride_weight_kg?: number | null;
          last_batch_at?: string | null;
          free_full_batches_used?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['snap_anchors']['Insert']>;
        Relationships: [];
      };
      snap_jobs: {
        Row: {
          id: string;
          user_id: string;
          kind: 'anchor' | 'catalog';
          fal_request_id: string;
          model: string;
          quality: string | null;
          catalog_id: string | null;
          catalog_path: 'anchored' | 'selfies' | 'couple' | null;
          anchor_slot: 'groom' | 'bride' | null;
          anchor_framing: 'closeup' | 'halfbody' | null;
          status: 'submitted' | 'in_progress' | 'completed' | 'failed' | 'timeout';
          result_url: string | null;
          credit_delta: number;
          error_message: string | null;
          submitted_at: string;
          completed_at: string | null;
          couple_photo_url: string | null;
          couple_photo_path: string | null;
          fal_cost_usd: number | null;
          phase_timings: Record<string, number> | null;
          pipeline_stages: Record<string, string | boolean | null> | null;
          image_reference: 'strict' | 'prompt-only' | null;
          liked: boolean;
          liked_at: string | null;
          regen_reason: 'face_unnatural' | 'pose_diff' | 'outfit_bg' | 'other' | null;
          regen_reason_text: string | null;
          regen_to_job_id: string | null;
          regen_used_free: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: 'anchor' | 'catalog';
          fal_request_id: string;
          model: string;
          quality?: string | null;
          catalog_id?: string | null;
          catalog_path?: 'anchored' | 'selfies' | 'couple' | null;
          anchor_slot?: 'groom' | 'bride' | null;
          anchor_framing?: 'closeup' | 'halfbody' | null;
          status: 'submitted' | 'in_progress' | 'completed' | 'failed' | 'timeout';
          result_url?: string | null;
          credit_delta?: number;
          error_message?: string | null;
          submitted_at?: string;
          completed_at?: string | null;
          couple_photo_url?: string | null;
          couple_photo_path?: string | null;
          fal_cost_usd?: number | null;
          phase_timings?: Record<string, number> | null;
          pipeline_stages?: Record<string, string | boolean | null> | null;
          image_reference?: 'strict' | 'prompt-only' | null;
          liked?: boolean;
          liked_at?: string | null;
          regen_reason?: 'face_unnatural' | 'pose_diff' | 'outfit_bg' | 'other' | null;
          regen_reason_text?: string | null;
          regen_to_job_id?: string | null;
          regen_used_free?: boolean;
        };
        Update: Partial<Database['public']['Tables']['snap_jobs']['Insert']>;
        Relationships: [];
      };
      snap_catalog_tags: {
        Row: {
          catalog_id: string;
          input_condition: 'selfies' | 'couple-fullbody';
          tag: 'recommend' | 'caution' | 'risky' | 'hidden';
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          catalog_id: string;
          input_condition: 'selfies' | 'couple-fullbody';
          tag: 'recommend' | 'caution' | 'risky' | 'hidden';
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['snap_catalog_tags']['Insert']>;
        Relationships: [];
      };
      marketing_home_samples: {
        Row: {
          id: boolean;
          ai_snap_catalog_ids: string[];
          designs: unknown;
          before_after: unknown | null;
          template: unknown | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: boolean;
          ai_snap_catalog_ids?: string[];
          designs?: unknown;
          before_after?: unknown | null;
          template?: unknown | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['marketing_home_samples']['Insert']>;
        Relationships: [];
      };
      snap_user_quota: {
        Row: {
          user_id: string;
          free_regen_remaining: number;
          total_granted: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          free_regen_remaining?: number;
          total_granted?: number;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['snap_user_quota']['Insert']>;
        Relationships: [];
      };
      snap_consent: {
        Row: {
          id: string;
          user_id: string;
          scope: 'personal_info' | 'ai_generation' | 'external_share';
          version: number;
          accepted: boolean;
          accepted_at: string;
          user_agent: string | null;
          ip_address: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          scope: 'personal_info' | 'ai_generation' | 'external_share';
          version: number;
          accepted?: boolean;
          accepted_at?: string;
          user_agent?: string | null;
          ip_address?: string | null;
        };
        Update: Partial<Database['public']['Tables']['snap_consent']['Insert']>;
        Relationships: [];
      };
      snap_anchor_history: {
        Row: {
          id: string;
          user_id: string;
          groom_anchor_url: string | null;
          bride_anchor_url: string | null;
          groom_selfie_url: string | null;
          bride_selfie_url: string | null;
          source_mode: 'selfies' | 'couple';
          groom_height_cm: number | null;
          groom_weight_kg: number | null;
          bride_height_cm: number | null;
          bride_weight_kg: number | null;
          anchor_created_at: string | null;
          discarded_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          groom_anchor_url?: string | null;
          bride_anchor_url?: string | null;
          groom_selfie_url?: string | null;
          bride_selfie_url?: string | null;
          source_mode: 'selfies' | 'couple';
          groom_height_cm?: number | null;
          groom_weight_kg?: number | null;
          bride_height_cm?: number | null;
          bride_weight_kg?: number | null;
          anchor_created_at?: string | null;
          discarded_at?: string;
        };
        Update: Partial<Database['public']['Tables']['snap_anchor_history']['Insert']>;
        Relationships: [];
      };
      publications: {
        Row: {
          id: string;
          invitation_id: string;
          user_id: string;
          slug: string;
          owner_token: string;
          archived: boolean;
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
          owner_token: string;
          archived?: boolean;
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
      invitation_cheers: {
        Row: {
          invitation_id: string;
          cheers_count: number;
          updated_at: string;
        };
        Insert: {
          invitation_id: string;
          cheers_count?: number;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['invitation_cheers']['Insert']>;
        Relationships: [];
      };
      gallery_likes: {
        Row: {
          invitation_id: string;
          image_index: number;
          like_count: number;
        };
        Insert: {
          invitation_id: string;
          image_index: number;
          like_count?: number;
        };
        Update: Partial<Database['public']['Tables']['gallery_likes']['Insert']>;
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
      ai_image_usage: {
        Row: {
          user_id: string;
          used_count: number;
          last_used_at: string;
          last_image_path: string | null;
        };
        Insert: {
          user_id: string;
          used_count?: number;
          last_used_at?: string;
          last_image_path?: string | null;
        };
        Update: Partial<Database['public']['Tables']['ai_image_usage']['Insert']>;
        Relationships: [];
      };
    };
    Views: {
      snap_catalog_stats: {
        Row: {
          catalog_id: string;
          mode: 'selfies' | 'couple' | 'unknown';
          gen_count: number;
          like_count: number;
          regen_count: number;
          regen_rate: number;
          like_rate: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      publish_invitation: {
        Args: { inv_id: string };
        Returns: boolean;
      };
      publish_invitation_v2: {
        Args: { inv_id: string; new_slug: string };
        Returns: Json;
      };
      publish_invitation_v3: {
        Args: { inv_id: string; new_slug: string; new_owner_tok: string };
        Returns: Json;
      };
      publish_invitation_v4: {
        Args: { inv_id: string; new_slug: string; new_owner_tok: string };
        Returns: Json;
      };
      archive_credits_balance: {
        Args: { uid: string };
        Returns: number;
      };
      apply_archive: {
        Args: { pub_id: string };
        Returns: Json;
      };
      user_has_package: {
        Args: { uid: string; pkg_code: string };
        Returns: boolean;
      };
      bump_cheers: {
        Args: { inv_id: string };
        Returns: number;
      };
      bump_gallery_like: {
        Args: { inv_id: string; img_idx: number };
        Returns: number;
      };
      publish_credits_balance: {
        Args: { uid: string };
        Returns: number;
      };
      snap_credits_balance: {
        Args: { uid: string };
        Returns: number;
      };
      consume_snap_credit: {
        Args: { p_user_id: string; p_note?: string | null };
        Returns: Json;
      };
      snap_has_required_consent: {
        Args: { p_user_id: string; p_version: number };
        Returns: boolean;
      };
      refund_snap_credit: {
        Args: { p_user_id: string; p_note?: string | null; p_ref_id?: string | null };
        Returns: void;
      };
      grant_welcome_snap_credit: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      has_purchased_snap: {
        Args: { p_user_id: string };
        Returns: boolean;
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
      grant_smartstore_order: {
        Args: {
          p_user_id: string;
          p_product_no: string;
          p_option_code: string;
          p_amount: number;
          p_naver_order_no?: string | null;
          p_naver_product_order_no?: string | null;
          p_raw?: Json;
        };
        Returns: Json;
      };
      consume_free_regen: {
        Args: { p_user_id: string; p_amount?: number };
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
