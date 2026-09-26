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
      activities: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          base_amount: number
          commission_amount: number
          commission_pct: number
          created_at: string
          id: string
          lead_id: string | null
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          base_amount?: number
          commission_amount?: number
          commission_pct?: number
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          base_amount?: number
          commission_amount?: number
          commission_pct?: number
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payout_requests: {
        Row: {
          affiliate_id: string
          amount: number
          approved_at: string | null
          created_at: string
          decision_reason: string | null
          id: string
          method: string
          notes: string | null
          paid_at: string | null
          processed_at: string | null
          processed_by: string | null
          reference: string | null
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          approved_at?: string | null
          created_at?: string
          decision_reason?: string | null
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          approved_at?: string | null
          created_at?: string
          decision_reason?: string | null
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payout_requests_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_payout_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_payout_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_settings: {
        Row: {
          cookie_days: number
          created_at: string
          default_commission_pct: number
          id: string
          payout_terms: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cookie_days?: number
          created_at?: string
          default_commission_pct?: number
          id?: string
          payout_terms?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cookie_days?: number
          created_at?: string
          default_commission_pct?: number
          id?: string
          payout_terms?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      affiliates: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          audience: string | null
          channels: string | null
          commission_pct: number
          company: string | null
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          payout_method: string | null
          referral_code: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          audience?: string | null
          channels?: string | null
          commission_pct?: number
          company?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          payout_method?: string | null
          referral_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          audience?: string | null
          channels?: string | null
          commission_pct?: number
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          payout_method?: string | null
          referral_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          created_at: string
          group_slug: string | null
          id: string
          model: string | null
          pack_slug: string | null
          prompt_chars: number
          response_chars: number
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          group_slug?: string | null
          id?: string
          model?: string | null
          pack_slug?: string | null
          prompt_chars?: number
          response_chars?: number
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          group_slug?: string | null
          id?: string
          model?: string | null
          pack_slug?: string | null
          prompt_chars?: number
          response_chars?: number
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          id: string
          is_enabled: boolean
          name: string
          tenant_id: string | null
          trigger: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          name: string
          tenant_id?: string | null
          trigger: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          name?: string
          tenant_id?: string | null
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_accounts: {
        Row: {
          category: string | null
          company: string
          contact_name: string | null
          created_at: string
          email: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          category?: string | null
          company: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          user_id?: string
          website?: string | null
        }
        Update: {
          category?: string | null
          company?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      brand_campaign_applications: {
        Row: {
          campaign_id: string
          created_at: string
          creator_id: string | null
          deal_id: string | null
          id: string
          owner_id: string
          pitch: string | null
          quote: number | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          creator_id?: string | null
          deal_id?: string | null
          id?: string
          owner_id?: string
          pitch?: string | null
          quote?: number | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          creator_id?: string | null
          deal_id?: string | null
          id?: string
          owner_id?: string
          pitch?: string | null
          quote?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_campaign_applications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "brand_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_campaign_applications_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_campaign_applications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "creator_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_campaigns: {
        Row: {
          brand_user_id: string
          brief: string | null
          budget: number | null
          category: string | null
          company: string
          created_at: string
          deadline: string | null
          id: string
          min_followers: number
          platform: string | null
          status: string
          title: string
        }
        Insert: {
          brand_user_id?: string
          brief?: string | null
          budget?: number | null
          category?: string | null
          company: string
          created_at?: string
          deadline?: string | null
          id?: string
          min_followers?: number
          platform?: string | null
          status?: string
          title: string
        }
        Update: {
          brand_user_id?: string
          brief?: string | null
          budget?: number | null
          category?: string | null
          company?: string
          created_at?: string
          deadline?: string | null
          id?: string
          min_followers?: number
          platform?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      canned_responses: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canned_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canned_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_campaigns: {
        Row: {
          active: boolean
          benefits: Json
          created_at: string
          cta_label: string
          ends_at: string | null
          form_fields: Json
          headline: string
          hero_image: string | null
          id: string
          slug: string
          starts_at: string | null
          subhead: string | null
          thank_you_message: string
          theme: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          benefits?: Json
          created_at?: string
          cta_label?: string
          ends_at?: string | null
          form_fields?: Json
          headline: string
          hero_image?: string | null
          id?: string
          slug: string
          starts_at?: string | null
          subhead?: string | null
          thank_you_message?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          benefits?: Json
          created_at?: string
          cta_label?: string
          ends_at?: string | null
          form_fields?: Json
          headline?: string
          hero_image?: string | null
          id?: string
          slug?: string
          starts_at?: string | null
          subhead?: string | null
          thank_you_message?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_home_slides: {
        Row: {
          active: boolean
          created_at: string
          cta_label: string | null
          cta_url: string | null
          headline: string
          id: string
          image_url: string | null
          sort_order: number
          subhead: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          headline: string
          id?: string
          image_url?: string | null
          sort_order?: number
          subhead?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          headline?: string
          id?: string
          image_url?: string | null
          sort_order?: number
          subhead?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cms_menu_items: {
        Row: {
          active: boolean
          created_at: string
          group_label: string | null
          id: string
          label: string
          location: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          group_label?: string | null
          id?: string
          label: string
          location: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          group_label?: string | null
          id?: string
          label?: string
          location?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      cms_pages: {
        Row: {
          body: Json
          canonical_override: string | null
          created_at: string
          created_by: string | null
          hero: Json
          id: string
          meta_description: string | null
          noindex: boolean
          og_image: string | null
          published_at: string | null
          seo_keywords: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: Json
          canonical_override?: string | null
          created_at?: string
          created_by?: string | null
          hero?: Json
          id?: string
          meta_description?: string | null
          noindex?: boolean
          og_image?: string | null
          published_at?: string | null
          seo_keywords?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: Json
          canonical_override?: string | null
          created_at?: string
          created_by?: string | null
          hero?: Json
          id?: string
          meta_description?: string | null
          noindex?: boolean
          og_image?: string | null
          published_at?: string | null
          seo_keywords?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_posts: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          cover_image: string | null
          created_at: string
          excerpt: string | null
          id: string
          og_image: string | null
          published_at: string | null
          reading_minutes: number
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          og_image?: string | null
          published_at?: string | null
          reading_minutes?: number
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          og_image?: string | null
          published_at?: string | null
          reading_minutes?: number
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_seo_settings: {
        Row: {
          default_description: string
          default_og_image: string | null
          default_title: string
          ga_id: string | null
          gtm_id: string | null
          id: string
          meta_pixel_id: string | null
          robots_default: string
          site_name: string
          twitter_handle: string | null
          updated_at: string
        }
        Insert: {
          default_description?: string
          default_og_image?: string | null
          default_title?: string
          ga_id?: string | null
          gtm_id?: string | null
          id: string
          meta_pixel_id?: string | null
          robots_default?: string
          site_name?: string
          twitter_handle?: string | null
          updated_at?: string
        }
        Update: {
          default_description?: string
          default_og_image?: string | null
          default_title?: string
          ga_id?: string | null
          gtm_id?: string | null
          id?: string
          meta_pixel_id?: string | null
          robots_default?: string
          site_name?: string
          twitter_handle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          annual_revenue: number | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          employee_count: number | null
          gst_number: string | null
          id: string
          industry: string | null
          industry_group: string | null
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          tenant_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          annual_revenue?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          employee_count?: number | null
          gst_number?: string | null
          id?: string
          industry?: string | null
          industry_group?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          tenant_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          annual_revenue?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          employee_count?: number | null
          gst_number?: string | null
          id?: string
          industry?: string | null
          industry_group?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          tenant_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          company: string | null
          created_at: string
          email: string
          handled: boolean
          id: string
          message: string | null
          name: string
          phone: string | null
          source: string
          updated_at: string
          utm: Json
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          handled?: boolean
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          source?: string
          updated_at?: string
          utm?: Json
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          handled?: boolean
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          source?: string
          updated_at?: string
          utm?: Json
        }
        Relationships: []
      }
      contacts: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          designation: string | null
          email: string | null
          first_name: string
          id: string
          industry_group: string | null
          last_name: string | null
          notes: string | null
          phone: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          designation?: string | null
          email?: string | null
          first_name: string
          id?: string
          industry_group?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          designation?: string | null
          email?: string | null
          first_name?: string
          id?: string
          industry_group?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_activities: {
        Row: {
          body: string
          brand_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          kind: string
          owner_id: string
        }
        Insert: {
          body: string
          brand_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          kind?: string
          owner_id?: string
        }
        Update: {
          body?: string
          brand_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          kind?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_activities_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "creator_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "creator_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_alert_log: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          ref_id: string
          rule: string
          sent_on: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          ref_id: string
          rule: string
          sent_on?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          ref_id?: string
          rule?: string
          sent_on?: string
        }
        Relationships: []
      }
      creator_brand_contacts: {
        Row: {
          brand_id: string
          created_at: string
          designation: string | null
          email: string | null
          id: string
          linkedin: string | null
          name: string
          owner_id: string
          phone: string | null
          role: string | null
          whatsapp: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          designation?: string | null
          email?: string | null
          id?: string
          linkedin?: string | null
          name: string
          owner_id?: string
          phone?: string | null
          role?: string | null
          whatsapp?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          designation?: string | null
          email?: string | null
          id?: string
          linkedin?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          role?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_brand_contacts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "creator_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_brands: {
        Row: {
          category: string | null
          company: string | null
          company_size: string | null
          created_at: string
          id: string
          industry: string | null
          location: string | null
          logo_url: string | null
          marketing_budget: number | null
          name: string
          notes: string | null
          owner_id: string
          preferred_content: string[]
          preferred_platforms: string[]
          socials: Json
          tags: string[]
          updated_at: string
          website: string | null
        }
        Insert: {
          category?: string | null
          company?: string | null
          company_size?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          marketing_budget?: number | null
          name: string
          notes?: string | null
          owner_id?: string
          preferred_content?: string[]
          preferred_platforms?: string[]
          socials?: Json
          tags?: string[]
          updated_at?: string
          website?: string | null
        }
        Update: {
          category?: string | null
          company?: string | null
          company_size?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          marketing_budget?: number | null
          name?: string
          notes?: string | null
          owner_id?: string
          preferred_content?: string[]
          preferred_platforms?: string[]
          socials?: Json
          tags?: string[]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      creator_contracts: {
        Row: {
          analysis: Json | null
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          body: string | null
          created_at: string
          deal_id: string
          expires_at: string | null
          id: string
          owner_id: string
          signed_at: string | null
          status: string
          title: string
        }
        Insert: {
          analysis?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          body?: string | null
          created_at?: string
          deal_id: string
          expires_at?: string | null
          id?: string
          owner_id?: string
          signed_at?: string | null
          status?: string
          title: string
        }
        Update: {
          analysis?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          body?: string | null
          created_at?: string
          deal_id?: string
          expires_at?: string | null
          id?: string
          owner_id?: string
          signed_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "creator_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_deal_comments: {
        Row: {
          author_id: string
          author_name: string | null
          author_role: string
          body: string
          created_at: string
          deal_id: string
          deliverable_id: string | null
          id: string
          owner_id: string
        }
        Insert: {
          author_id?: string
          author_name?: string | null
          author_role?: string
          body: string
          created_at?: string
          deal_id: string
          deliverable_id?: string | null
          id?: string
          owner_id: string
        }
        Update: {
          author_id?: string
          author_name?: string | null
          author_role?: string
          body?: string
          created_at?: string
          deal_id?: string
          deliverable_id?: string | null
          id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_deal_comments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "creator_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_deal_comments_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "creator_deliverables"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_deals: {
        Row: {
          agency: string | null
          approval_token: string
          brand_email: string | null
          brand_id: string | null
          brand_user_id: string | null
          campaign: string
          campaign_manager: string | null
          commission_pct: number
          created_at: string
          creator_id: string | null
          currency: string
          deadline: string | null
          deal_type: string | null
          end_date: string | null
          exclusivity: string | null
          gst_pct: number
          id: string
          next_action: string | null
          next_action_at: string | null
          notes: string | null
          objective: string | null
          owner_id: string
          payment_terms: string | null
          platform: string | null
          probability: number
          requirements: string | null
          source: string
          stage: string
          start_date: string | null
          updated_at: string
          usage_rights: string | null
          value: number
        }
        Insert: {
          agency?: string | null
          approval_token?: string
          brand_email?: string | null
          brand_id?: string | null
          brand_user_id?: string | null
          campaign: string
          campaign_manager?: string | null
          commission_pct?: number
          created_at?: string
          creator_id?: string | null
          currency?: string
          deadline?: string | null
          deal_type?: string | null
          end_date?: string | null
          exclusivity?: string | null
          gst_pct?: number
          id?: string
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          objective?: string | null
          owner_id?: string
          payment_terms?: string | null
          platform?: string | null
          probability?: number
          requirements?: string | null
          source?: string
          stage?: string
          start_date?: string | null
          updated_at?: string
          usage_rights?: string | null
          value?: number
        }
        Update: {
          agency?: string | null
          approval_token?: string
          brand_email?: string | null
          brand_id?: string | null
          brand_user_id?: string | null
          campaign?: string
          campaign_manager?: string | null
          commission_pct?: number
          created_at?: string
          creator_id?: string | null
          currency?: string
          deadline?: string | null
          deal_type?: string | null
          end_date?: string | null
          exclusivity?: string | null
          gst_pct?: number
          id?: string
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          objective?: string | null
          owner_id?: string
          payment_terms?: string | null
          platform?: string | null
          probability?: number
          requirements?: string | null
          source?: string
          stage?: string
          start_date?: string | null
          updated_at?: string
          usage_rights?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_deals_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "creator_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_deals_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_deliverables: {
        Row: {
          brand_comment: string | null
          caption: string | null
          clicks: number
          content_type: string
          conversions: number
          created_at: string
          deal_id: string
          draft_url: string | null
          due_date: string | null
          engagements: number
          id: string
          owner_id: string
          platform: string | null
          posted_at: string | null
          quantity: number
          reach: number
          revenue_generated: number
          revision_count: number
          script: string | null
          status: string
          updated_at: string
          views: number
        }
        Insert: {
          brand_comment?: string | null
          caption?: string | null
          clicks?: number
          content_type: string
          conversions?: number
          created_at?: string
          deal_id: string
          draft_url?: string | null
          due_date?: string | null
          engagements?: number
          id?: string
          owner_id?: string
          platform?: string | null
          posted_at?: string | null
          quantity?: number
          reach?: number
          revenue_generated?: number
          revision_count?: number
          script?: string | null
          status?: string
          updated_at?: string
          views?: number
        }
        Update: {
          brand_comment?: string | null
          caption?: string | null
          clicks?: number
          content_type?: string
          conversions?: number
          created_at?: string
          deal_id?: string
          draft_url?: string | null
          due_date?: string | null
          engagements?: number
          id?: string
          owner_id?: string
          platform?: string | null
          posted_at?: string | null
          quantity?: number
          reach?: number
          revenue_generated?: number
          revision_count?: number
          script?: string | null
          status?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_deliverables_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "creator_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_email_outbox: {
        Row: {
          audience: string
          body: string
          created_at: string
          error: string | null
          id: string
          link: string | null
          owner_id: string
          rule: string
          sent_at: string | null
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          error?: string | null
          id?: string
          link?: string | null
          owner_id: string
          rule: string
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          error?: string | null
          id?: string
          link?: string | null
          owner_id?: string
          rule?: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: []
      }
      creator_income: {
        Row: {
          amount: number
          created_at: string
          creator_id: string | null
          id: string
          note: string | null
          owner_id: string
          received_on: string
          stream: string
        }
        Insert: {
          amount?: number
          created_at?: string
          creator_id?: string | null
          id?: string
          note?: string | null
          owner_id?: string
          received_on?: string
          stream: string
        }
        Update: {
          amount?: number
          created_at?: string
          creator_id?: string | null
          id?: string
          note?: string | null
          owner_id?: string
          received_on?: string
          stream?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_income_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_instagram: {
        Row: {
          access_token_ciphertext: string | null
          created_at: string
          engagement_rate: number | null
          followers: number | null
          ig_user_id: string | null
          last_error: string | null
          media_count: number | null
          owner_id: string
          profile_id: string
          synced_at: string | null
          token_expires_at: string | null
          username: string | null
        }
        Insert: {
          access_token_ciphertext?: string | null
          created_at?: string
          engagement_rate?: number | null
          followers?: number | null
          ig_user_id?: string | null
          last_error?: string | null
          media_count?: number | null
          owner_id: string
          profile_id: string
          synced_at?: string | null
          token_expires_at?: string | null
          username?: string | null
        }
        Update: {
          access_token_ciphertext?: string | null
          created_at?: string
          engagement_rate?: number | null
          followers?: number | null
          ig_user_id?: string | null
          last_error?: string | null
          media_count?: number | null
          owner_id?: string
          profile_id?: string
          synced_at?: string | null
          token_expires_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_instagram_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_invoices: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          created_at: string
          deal_id: string
          due_date: string | null
          id: string
          issued_at: string | null
          notes: string | null
          number: string
          owner_id: string
          paid_amount: number
          paid_at: string | null
          status: string
          tax_pct: number
          updated_at: string
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          created_at?: string
          deal_id: string
          due_date?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          number: string
          owner_id?: string
          paid_amount?: number
          paid_at?: string | null
          status?: string
          tax_pct?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          created_at?: string
          deal_id?: string
          due_date?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          number?: string
          owner_id?: string
          paid_amount?: number
          paid_at?: string | null
          status?: string
          tax_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "creator_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_profiles: {
        Row: {
          agency_commission_pct: number
          audience: Json
          avatar_url: string | null
          bio: string | null
          categories: string[]
          created_at: string
          display_name: string
          engagement_rate: number
          followers: number
          handle: string
          id: string
          is_public: boolean
          location: string | null
          manager_name: string | null
          niche: string | null
          owner_id: string
          past_brands: string[]
          platforms: Json
          testimonials: Json
          updated_at: string
        }
        Insert: {
          agency_commission_pct?: number
          audience?: Json
          avatar_url?: string | null
          bio?: string | null
          categories?: string[]
          created_at?: string
          display_name: string
          engagement_rate?: number
          followers?: number
          handle: string
          id?: string
          is_public?: boolean
          location?: string | null
          manager_name?: string | null
          niche?: string | null
          owner_id?: string
          past_brands?: string[]
          platforms?: Json
          testimonials?: Json
          updated_at?: string
        }
        Update: {
          agency_commission_pct?: number
          audience?: Json
          avatar_url?: string | null
          bio?: string | null
          categories?: string[]
          created_at?: string
          display_name?: string
          engagement_rate?: number
          followers?: number
          handle?: string
          id?: string
          is_public?: boolean
          location?: string | null
          manager_name?: string | null
          niche?: string | null
          owner_id?: string
          past_brands?: string[]
          platforms?: Json
          testimonials?: Json
          updated_at?: string
        }
        Relationships: []
      }
      creator_rate_cards: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          item: string
          kind: string
          owner_id: string
          platform: string | null
          price: number
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          item: string
          kind?: string
          owner_id?: string
          platform?: string | null
          price?: number
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          item?: string
          kind?: string
          owner_id?: string
          platform?: string | null
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_rate_cards_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_team_members: {
        Row: {
          created_at: string
          email: string
          id: string
          member_user_id: string | null
          owner_id: string
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          member_user_id?: string | null
          owner_id?: string
          role: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          member_user_id?: string | null
          owner_id?: string
          role?: string
          status?: string
        }
        Relationships: []
      }
      dashboard_layouts: {
        Row: {
          created_at: string
          hidden_widgets: string[]
          layout: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hidden_widgets?: string[]
          layout?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hidden_widgets?: string[]
          layout?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dist_beats: {
        Row: {
          area: string
          created_at: string
          id: string
          owner_id: string
          partner_ids: string[]
          sales_rep: string
          weekday: number
        }
        Insert: {
          area: string
          created_at?: string
          id?: string
          owner_id?: string
          partner_ids?: string[]
          sales_rep: string
          weekday: number
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          owner_id?: string
          partner_ids?: string[]
          sales_rep?: string
          weekday?: number
        }
        Relationships: []
      }
      dist_collections: {
        Row: {
          amount: number
          collected_by: string | null
          collected_on: string
          created_at: string
          id: string
          method: string
          owner_id: string
          partner_id: string
          reference: string | null
          status: string
        }
        Insert: {
          amount: number
          collected_by?: string | null
          collected_on?: string
          created_at?: string
          id?: string
          method?: string
          owner_id?: string
          partner_id: string
          reference?: string | null
          status?: string
        }
        Update: {
          amount?: number
          collected_by?: string | null
          collected_on?: string
          created_at?: string
          id?: string
          method?: string
          owner_id?: string
          partner_id?: string
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dist_collections_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "dist_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      dist_loyalty: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          partner_id: string
          points: number
          reason: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id?: string
          partner_id: string
          points: number
          reason?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          partner_id?: string
          points?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dist_loyalty_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "dist_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      dist_order_items: {
        Row: {
          free_qty: number
          id: string
          line_total: number
          order_id: string
          owner_id: string
          price: number
          product_id: string | null
          qty: number
          scheme: string | null
        }
        Insert: {
          free_qty?: number
          id?: string
          line_total?: number
          order_id: string
          owner_id?: string
          price?: number
          product_id?: string | null
          qty?: number
          scheme?: string | null
        }
        Update: {
          free_qty?: number
          id?: string
          line_total?: number
          order_id?: string
          owner_id?: string
          price?: number
          product_id?: string | null
          qty?: number
          scheme?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dist_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "dist_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dist_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "dist_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dist_orders: {
        Row: {
          created_at: string
          discount: number
          id: string
          number: string
          order_date: string
          owner_id: string
          partner_id: string | null
          raw_message: string | null
          sales_rep: string | null
          source: string
          status: string
          subtotal: number
          total: number
        }
        Insert: {
          created_at?: string
          discount?: number
          id?: string
          number?: string
          order_date?: string
          owner_id?: string
          partner_id?: string | null
          raw_message?: string | null
          sales_rep?: string | null
          source?: string
          status?: string
          subtotal?: number
          total?: number
        }
        Update: {
          created_at?: string
          discount?: number
          id?: string
          number?: string
          order_date?: string
          owner_id?: string
          partner_id?: string | null
          raw_message?: string | null
          sales_rep?: string | null
          source?: string
          status?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "dist_orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "dist_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      dist_partner_sales: {
        Row: {
          amount: number
          created_at: string
          customer: string | null
          id: string
          owner_id: string
          partner_id: string
          product_id: string
          qty: number
          sold_on: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer?: string | null
          id?: string
          owner_id: string
          partner_id: string
          product_id: string
          qty: number
          sold_on?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer?: string | null
          id?: string
          owner_id?: string
          partner_id?: string
          product_id?: string
          qty?: number
          sold_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "dist_partner_sales_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "dist_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dist_partner_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "dist_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dist_partner_stock: {
        Row: {
          id: string
          owner_id: string
          partner_id: string
          product_id: string
          qty: number
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          partner_id: string
          product_id: string
          qty?: number
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          partner_id?: string
          product_id?: string
          qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dist_partner_stock_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "dist_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dist_partner_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "dist_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dist_partners: {
        Row: {
          address: string | null
          category: string | null
          city: string | null
          created_at: string
          credit_limit: number
          email: string | null
          gstin: string | null
          id: string
          lat: number | null
          level: string
          lng: number | null
          loyalty_points: number
          name: string
          onboarding_stage: string
          owner_id: string
          owner_name: string | null
          pan: string | null
          parent_id: string | null
          payment_terms_days: number
          phone: string | null
          portal_email: string | null
          portal_user_id: string | null
          sales_rep: string | null
          state: string | null
          territory: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          credit_limit?: number
          email?: string | null
          gstin?: string | null
          id?: string
          lat?: number | null
          level?: string
          lng?: number | null
          loyalty_points?: number
          name: string
          onboarding_stage?: string
          owner_id?: string
          owner_name?: string | null
          pan?: string | null
          parent_id?: string | null
          payment_terms_days?: number
          phone?: string | null
          portal_email?: string | null
          portal_user_id?: string | null
          sales_rep?: string | null
          state?: string | null
          territory?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string | null
          city?: string | null
          created_at?: string
          credit_limit?: number
          email?: string | null
          gstin?: string | null
          id?: string
          lat?: number | null
          level?: string
          lng?: number | null
          loyalty_points?: number
          name?: string
          onboarding_stage?: string
          owner_id?: string
          owner_name?: string | null
          pan?: string | null
          parent_id?: string | null
          payment_terms_days?: number
          phone?: string | null
          portal_email?: string | null
          portal_user_id?: string | null
          sales_rep?: string | null
          state?: string | null
          territory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dist_partners_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "dist_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      dist_products: {
        Row: {
          category: string | null
          created_at: string
          daily_run_rate: number
          expiry_date: string | null
          id: string
          name: string
          owner_id: string
          price: number
          reorder_level: number
          sku: string
          stock: number
          unit: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          daily_run_rate?: number
          expiry_date?: string | null
          id?: string
          name: string
          owner_id?: string
          price?: number
          reorder_level?: number
          sku: string
          stock?: number
          unit?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          daily_run_rate?: number
          expiry_date?: string | null
          id?: string
          name?: string
          owner_id?: string
          price?: number
          reorder_level?: number
          sku?: string
          stock?: number
          unit?: string
        }
        Relationships: []
      }
      dist_schemes: {
        Row: {
          active: boolean
          applies_to: string
          buy_qty: number | null
          created_at: string
          discount_pct: number | null
          ends_on: string | null
          free_qty: number | null
          id: string
          kind: string
          min_value: number | null
          name: string
          owner_id: string
          product_id: string | null
          starts_on: string | null
        }
        Insert: {
          active?: boolean
          applies_to?: string
          buy_qty?: number | null
          created_at?: string
          discount_pct?: number | null
          ends_on?: string | null
          free_qty?: number | null
          id?: string
          kind?: string
          min_value?: number | null
          name: string
          owner_id?: string
          product_id?: string | null
          starts_on?: string | null
        }
        Update: {
          active?: boolean
          applies_to?: string
          buy_qty?: number | null
          created_at?: string
          discount_pct?: number | null
          ends_on?: string | null
          free_qty?: number | null
          id?: string
          kind?: string
          min_value?: number | null
          name?: string
          owner_id?: string
          product_id?: string | null
          starts_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dist_schemes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "dist_products"
            referencedColumns: ["id"]
          },
        ]
      }
      dist_targets: {
        Row: {
          created_at: string
          id: string
          incentive_type: string | null
          incentive_value: number | null
          owner_id: string
          partner_id: string | null
          period_end: string
          period_start: string
          scope: string
          scope_name: string
          target: number
        }
        Insert: {
          created_at?: string
          id?: string
          incentive_type?: string | null
          incentive_value?: number | null
          owner_id?: string
          partner_id?: string | null
          period_end?: string
          period_start?: string
          scope?: string
          scope_name: string
          target?: number
        }
        Update: {
          created_at?: string
          id?: string
          incentive_type?: string | null
          incentive_value?: number | null
          owner_id?: string
          partner_id?: string | null
          period_end?: string
          period_start?: string
          scope?: string
          scope_name?: string
          target?: number
        }
        Relationships: [
          {
            foreignKeyName: "dist_targets_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "dist_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      dist_visits: {
        Row: {
          ai_summary: string | null
          checked_in_at: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          next_visit: string | null
          notes: string | null
          order_id: string | null
          outcome: string | null
          owner_id: string
          partner_id: string
          photo_path: string | null
          sales_rep: string
        }
        Insert: {
          ai_summary?: string | null
          checked_in_at?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          next_visit?: string | null
          notes?: string | null
          order_id?: string | null
          outcome?: string | null
          owner_id?: string
          partner_id: string
          photo_path?: string | null
          sales_rep: string
        }
        Update: {
          ai_summary?: string | null
          checked_in_at?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          next_visit?: string | null
          notes?: string | null
          order_id?: string | null
          outcome?: string | null
          owner_id?: string
          partner_id?: string
          photo_path?: string | null
          sales_rep?: string
        }
        Relationships: [
          {
            foreignKeyName: "dist_visits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "dist_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dist_visits_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "dist_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_actions: {
        Row: {
          agent: string | null
          audience: string
          created_at: string
          fee_id: string | null
          id: string
          kind: string
          message: string | null
          priority: number
          reason: string | null
          status: string
          student_id: string | null
          tenant_id: string
        }
        Insert: {
          agent?: string | null
          audience?: string
          created_at?: string
          fee_id?: string | null
          id?: string
          kind: string
          message?: string | null
          priority?: number
          reason?: string | null
          status?: string
          student_id?: string | null
          tenant_id: string
        }
        Update: {
          agent?: string | null
          audience?: string
          created_at?: string
          fee_id?: string | null
          id?: string
          kind?: string
          message?: string | null
          priority?: number
          reason?: string | null
          status?: string
          student_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_actions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "edu_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_attendance: {
        Row: {
          batch_id: string | null
          created_at: string
          day: string
          id: string
          present: boolean
          student_id: string
          tenant_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          day?: string
          id?: string
          present?: boolean
          student_id: string
          tenant_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          day?: string
          id?: string
          present?: boolean
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_attendance_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "edu_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "edu_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_batches: {
        Row: {
          branch_id: string | null
          capacity: number | null
          course_id: string | null
          created_at: string
          faculty: string | null
          id: string
          name: string
          room: string | null
          start_date: string | null
          tenant_id: string
          timing: string | null
        }
        Insert: {
          branch_id?: string | null
          capacity?: number | null
          course_id?: string | null
          created_at?: string
          faculty?: string | null
          id?: string
          name: string
          room?: string | null
          start_date?: string | null
          tenant_id: string
          timing?: string | null
        }
        Update: {
          branch_id?: string | null
          capacity?: number | null
          course_id?: string | null
          created_at?: string
          faculty?: string | null
          id?: string
          name?: string
          room?: string | null
          start_date?: string | null
          tenant_id?: string
          timing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edu_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "edu_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_batches_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "edu_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_branches: {
        Row: {
          agreement_end: string | null
          city: string | null
          created_at: string
          franchisee_name: string | null
          franchisee_phone: string | null
          id: string
          kind: string
          marketing_fee_pct: number
          monthly_target: number | null
          name: string
          royalty_pct: number
          tenant_id: string
          territory: string | null
        }
        Insert: {
          agreement_end?: string | null
          city?: string | null
          created_at?: string
          franchisee_name?: string | null
          franchisee_phone?: string | null
          id?: string
          kind?: string
          marketing_fee_pct?: number
          monthly_target?: number | null
          name: string
          royalty_pct?: number
          tenant_id: string
          territory?: string | null
        }
        Update: {
          agreement_end?: string | null
          city?: string | null
          created_at?: string
          franchisee_name?: string | null
          franchisee_phone?: string | null
          id?: string
          kind?: string
          marketing_fee_pct?: number
          monthly_target?: number | null
          name?: string
          royalty_pct?: number
          tenant_id?: string
          territory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edu_branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_courses: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          duration_months: number | null
          exam: string | null
          fee: number
          id: string
          mode: string | null
          name: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_months?: number | null
          exam?: string | null
          fee?: number
          id?: string
          mode?: string | null
          name: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_months?: number | null
          exam?: string | null
          fee?: number
          id?: string
          mode?: string | null
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_courses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_courses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_demos: {
        Row: {
          batch_id: string | null
          created_at: string
          feedback: string | null
          id: string
          scheduled_at: string
          status: string
          student_id: string
          tenant_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          scheduled_at: string
          status?: string
          student_id: string
          tenant_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          scheduled_at?: string
          status?: string
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_demos_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "edu_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_demos_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "edu_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_demos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_demos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_documents: {
        Row: {
          created_at: string
          doc_type: string
          error: string | null
          id: string
          identifier_masked: string | null
          provider: string | null
          result: Json | null
          status: string
          student_id: string
          submitted_by: string | null
          tenant_id: string
          updated_at: string
          verification_id: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          error?: string | null
          id?: string
          identifier_masked?: string | null
          provider?: string | null
          result?: Json | null
          status?: string
          student_id: string
          submitted_by?: string | null
          tenant_id: string
          updated_at?: string
          verification_id?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          error?: string | null
          id?: string
          identifier_masked?: string | null
          provider?: string | null
          result?: Json | null
          status?: string
          student_id?: string
          submitted_by?: string | null
          tenant_id?: string
          updated_at?: string
          verification_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edu_documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "edu_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_fees: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          label: string
          method: string | null
          paid_amount: number
          paid_at: string | null
          reported_amount: number | null
          reported_at: string | null
          reported_reference: string | null
          status: string
          student_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          label?: string
          method?: string | null
          paid_amount?: number
          paid_at?: string | null
          reported_amount?: number | null
          reported_at?: string | null
          reported_reference?: string | null
          status?: string
          student_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          label?: string
          method?: string | null
          paid_amount?: number
          paid_at?: string | null
          reported_amount?: number | null
          reported_at?: string | null
          reported_reference?: string | null
          status?: string
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "edu_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_fees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_fees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_royalties: {
        Row: {
          branch_id: string
          collection: number
          created_at: string
          id: string
          marketing_fee: number
          paid_on: string | null
          period: string
          reference: string | null
          royalty: number
          status: string
          tenant_id: string
        }
        Insert: {
          branch_id: string
          collection?: number
          created_at?: string
          id?: string
          marketing_fee?: number
          paid_on?: string | null
          period: string
          reference?: string | null
          royalty?: number
          status?: string
          tenant_id: string
        }
        Update: {
          branch_id?: string
          collection?: number
          created_at?: string
          id?: string
          marketing_fee?: number
          paid_on?: string | null
          period?: string
          reference?: string | null
          royalty?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_royalties_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "edu_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_royalties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_royalties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_students: {
        Row: {
          admitted_at: string | null
          applicant_email: string | null
          applicant_user_id: string | null
          batch_id: string | null
          board: string | null
          branch_id: string | null
          budget: number | null
          city: string | null
          class_level: string | null
          counsellor: string | null
          course_id: string | null
          created_at: string
          current_score: number | null
          discount: number | null
          doc_status: string
          email: string | null
          exam: string | null
          fee_total: number | null
          id: string
          last_contacted_at: string | null
          lead_score: number | null
          lost_reason: string | null
          name: string
          notes: string | null
          parent_name: string | null
          parent_occupation: string | null
          parent_phone: string | null
          parent_relation: string | null
          phone: string | null
          scholarship: number | null
          school: string | null
          source: string | null
          stage: string
          target_year: number | null
          temperature: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          admitted_at?: string | null
          applicant_email?: string | null
          applicant_user_id?: string | null
          batch_id?: string | null
          board?: string | null
          branch_id?: string | null
          budget?: number | null
          city?: string | null
          class_level?: string | null
          counsellor?: string | null
          course_id?: string | null
          created_at?: string
          current_score?: number | null
          discount?: number | null
          doc_status?: string
          email?: string | null
          exam?: string | null
          fee_total?: number | null
          id?: string
          last_contacted_at?: string | null
          lead_score?: number | null
          lost_reason?: string | null
          name: string
          notes?: string | null
          parent_name?: string | null
          parent_occupation?: string | null
          parent_phone?: string | null
          parent_relation?: string | null
          phone?: string | null
          scholarship?: number | null
          school?: string | null
          source?: string | null
          stage?: string
          target_year?: number | null
          temperature?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          admitted_at?: string | null
          applicant_email?: string | null
          applicant_user_id?: string | null
          batch_id?: string | null
          board?: string | null
          branch_id?: string | null
          budget?: number | null
          city?: string | null
          class_level?: string | null
          counsellor?: string | null
          course_id?: string | null
          created_at?: string
          current_score?: number | null
          discount?: number | null
          doc_status?: string
          email?: string | null
          exam?: string | null
          fee_total?: number | null
          id?: string
          last_contacted_at?: string | null
          lead_score?: number | null
          lost_reason?: string | null
          name?: string
          notes?: string | null
          parent_name?: string | null
          parent_occupation?: string | null
          parent_phone?: string | null
          parent_relation?: string | null
          phone?: string | null
          scholarship?: number | null
          school?: string | null
          source?: string | null
          stage?: string
          target_year?: number | null
          temperature?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_students_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "edu_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_students_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "edu_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_students_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "edu_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_tests: {
        Row: {
          created_at: string
          id: string
          marks: number
          max_marks: number
          rank: number | null
          remarks: string | null
          student_id: string
          subject: string | null
          tenant_id: string
          test_date: string
          test_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          marks: number
          max_marks?: number
          rank?: number | null
          remarks?: string | null
          student_id: string
          subject?: string | null
          tenant_id: string
          test_date?: string
          test_name: string
        }
        Update: {
          created_at?: string
          id?: string
          marks?: number
          max_marks?: number
          rank?: number | null
          remarks?: string | null
          student_id?: string
          subject?: string | null
          tenant_id?: string
          test_date?: string
          test_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_tests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "edu_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_tests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_tests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_bank_accounts: {
        Row: {
          account_number: string | null
          bank_name: string | null
          created_at: string
          id: string
          ifsc: string | null
          is_default: boolean
          name: string
          opening_balance: number
          owner_id: string | null
          tenant_id: string | null
          upi_id: string | null
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          ifsc?: string | null
          is_default?: boolean
          name: string
          opening_balance?: number
          owner_id?: string | null
          tenant_id?: string | null
          upi_id?: string | null
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          ifsc?: string | null
          is_default?: boolean
          name?: string
          opening_balance?: number
          owner_id?: string | null
          tenant_id?: string | null
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_bank_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_bank_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_invoices: {
        Row: {
          amount: number
          bank_account_id: string | null
          category: string
          created_at: string
          due_date: string | null
          gst_pct: number
          id: string
          kind: string
          notes: string | null
          number: string
          owner_id: string | null
          paid_at: string | null
          party_email: string | null
          party_name: string
          status: string
          tenant_id: string | null
          utr: string | null
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category?: string
          created_at?: string
          due_date?: string | null
          gst_pct?: number
          id?: string
          kind?: string
          notes?: string | null
          number: string
          owner_id?: string | null
          paid_at?: string | null
          party_email?: string | null
          party_name: string
          status?: string
          tenant_id?: string | null
          utr?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category?: string
          created_at?: string
          due_date?: string | null
          gst_pct?: number
          id?: string
          kind?: string
          notes?: string | null
          number?: string
          owner_id?: string | null
          paid_at?: string | null
          party_email?: string | null
          party_name?: string
          status?: string
          tenant_id?: string | null
          utr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_invoices_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "fin_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_ledger: {
        Row: {
          amount: number
          bank_account_id: string | null
          category: string
          created_at: string
          created_by: string | null
          direction: string
          entry_date: string
          id: string
          memo: string | null
          method: string | null
          owner_id: string | null
          party: string | null
          source_id: string | null
          source_table: string
          tenant_id: string | null
          utr: string | null
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          direction: string
          entry_date?: string
          id?: string
          memo?: string | null
          method?: string | null
          owner_id?: string | null
          party?: string | null
          source_id?: string | null
          source_table?: string
          tenant_id?: string | null
          utr?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          entry_date?: string
          id?: string
          memo?: string | null
          method?: string | null
          owner_id?: string | null
          party?: string | null
          source_id?: string | null
          source_table?: string
          tenant_id?: string | null
          utr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_ledger_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "fin_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_webhooks_log: {
        Row: {
          attempts: number
          attempts_log: Json
          created_at: string
          dead_letter: boolean
          event_id: string | null
          id: string
          last_error: string | null
          message: string | null
          next_retry_at: string | null
          ok: boolean
          payload: Json | null
          source: string
          status_code: number
          tenant_id: string | null
        }
        Insert: {
          attempts?: number
          attempts_log?: Json
          created_at?: string
          dead_letter?: boolean
          event_id?: string | null
          id?: string
          last_error?: string | null
          message?: string | null
          next_retry_at?: string | null
          ok: boolean
          payload?: Json | null
          source: string
          status_code: number
          tenant_id?: string | null
        }
        Update: {
          attempts?: number
          attempts_log?: Json
          created_at?: string
          dead_letter?: boolean
          event_id?: string | null
          id?: string
          last_error?: string | null
          message?: string | null
          next_retry_at?: string | null
          ok?: boolean
          payload?: Json | null
          source?: string
          status_code?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_webhooks_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_webhooks_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      it_projects: {
        Row: {
          budget: number | null
          client_email: string | null
          client_name: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          manager_id: string | null
          name: string
          owner_id: string | null
          stage: string
          start_date: string | null
          tech_stack: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          budget?: number | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          manager_id?: string | null
          name: string
          owner_id?: string | null
          stage?: string
          start_date?: string | null
          tech_stack?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          budget?: number | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          owner_id?: string | null
          stage?: string
          start_date?: string | null
          tech_stack?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: []
      }
      it_tickets: {
        Row: {
          assignee_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          owner_id: string | null
          priority: string | null
          project_id: string | null
          resolved_at: string | null
          status: string | null
          ticket_type: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          priority?: string | null
          project_id?: string | null
          resolved_at?: string | null
          status?: string | null
          ticket_type?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          priority?: string | null
          project_id?: string | null
          resolved_at?: string | null
          status?: string | null
          ticket_type?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "it_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "it_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          event_type: string
          id: string
          page_slug: string
          referrer: string | null
          session_id: string | null
          source: string | null
          tenant_id: string
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event_type: string
          id?: string
          page_slug?: string
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          tenant_id: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event_type?: string
          id?: string
          page_slug?: string
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          tenant_id?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_campaigns: {
        Row: {
          budget: number | null
          channel_id: string | null
          code: string
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          is_active: boolean
          name: string
          starts_on: string | null
          tenant_id: string | null
        }
        Insert: {
          budget?: number | null
          channel_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          is_active?: boolean
          name: string
          starts_on?: string | null
          tenant_id?: string | null
        }
        Update: {
          budget?: number | null
          channel_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          is_active?: boolean
          name?: string
          starts_on?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_campaigns_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "lead_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_channels: {
        Row: {
          created_at: string
          created_by: string | null
          default_group_slug: string | null
          default_pack_slug: string | null
          id: string
          is_active: boolean
          kind: string
          monthly_cost: number | null
          name: string
          slug: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_group_slug?: string | null
          default_pack_slug?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          monthly_cost?: number | null
          name: string
          slug: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_group_slug?: string | null
          default_pack_slug?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          monthly_cost?: number | null
          name?: string
          slug?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_conversions: {
        Row: {
          campaign_id: string | null
          channel_id: string | null
          created_at: string
          group_slug: string | null
          id: string
          industry_group: string | null
          lead_id: string | null
          occurred_at: string
          pack_record_id: string | null
          pack_slug: string | null
          revenue: number
          stage: string
          status: string
          tenant_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          channel_id?: string | null
          created_at?: string
          group_slug?: string | null
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          occurred_at?: string
          pack_record_id?: string | null
          pack_slug?: string | null
          revenue?: number
          stage?: string
          status?: string
          tenant_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          channel_id?: string | null
          created_at?: string
          group_slug?: string | null
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          occurred_at?: string
          pack_record_id?: string | null
          pack_slug?: string | null
          revenue?: number
          stage?: string
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_conversions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "lead_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "lead_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversions_pack_record_id_fkey"
            columns: ["pack_record_id"]
            isOneToOne: false
            referencedRelation: "pack_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          affiliate_id: string | null
          alternate_phone: string | null
          assigned_to: string | null
          campaign: string | null
          campaign_id: string | null
          channel_id: string | null
          city: string | null
          company_id: string | null
          company_name: string
          contact_id: string | null
          contact_person: string | null
          converted_at: string | null
          country: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          designation: string | null
          email: string | null
          estimated_value: number | null
          expected_close_date: string | null
          external_ref: string | null
          id: string
          industry: string | null
          industry_group: string | null
          notes: string | null
          phone: string | null
          priority: Database["public"]["Enums"]["lead_priority"]
          source: string | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          tags: string[] | null
          tenant_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          affiliate_id?: string | null
          alternate_phone?: string | null
          assigned_to?: string | null
          campaign?: string | null
          campaign_id?: string | null
          channel_id?: string | null
          city?: string | null
          company_id?: string | null
          company_name: string
          contact_id?: string | null
          contact_person?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          designation?: string | null
          email?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          external_ref?: string | null
          id?: string
          industry?: string | null
          industry_group?: string | null
          notes?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          source?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          tenant_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          affiliate_id?: string | null
          alternate_phone?: string | null
          assigned_to?: string | null
          campaign?: string | null
          campaign_id?: string | null
          channel_id?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string
          contact_id?: string | null
          contact_person?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          designation?: string | null
          email?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          external_ref?: string | null
          id?: string
          industry?: string | null
          industry_group?: string | null
          notes?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          source?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          tenant_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "lead_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "lead_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lenders: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          lender_type: string
          logo_url: string | null
          name: string
          notes: string | null
          payout_pct: number | null
          processing_fee_pct: number | null
          roi_max: number | null
          roi_min: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          lender_type?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          payout_pct?: number | null
          processing_fee_pct?: number | null
          roi_max?: number | null
          roi_min?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          lender_type?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          payout_pct?: number | null
          processing_fee_pct?: number | null
          roi_max?: number | null
          roi_min?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      loan_applications: {
        Row: {
          applicant_name: string
          assigned_to: string | null
          city: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          disbursed_amount: number | null
          disbursed_at: string | null
          email: string | null
          emi: number | null
          employer_name: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          existing_emi: number | null
          id: string
          lender_id: string | null
          loan_product_id: string | null
          loan_type: Database["public"]["Enums"]["loan_type"]
          monthly_income: number | null
          notes: string | null
          pan: string | null
          phone: string | null
          purpose: string | null
          rejection_reason: string | null
          requested_amount: number
          roi: number | null
          sanctioned_amount: number | null
          source: string | null
          stage: Database["public"]["Enums"]["loan_stage"]
          tenure_months: number | null
          updated_at: string
        }
        Insert: {
          applicant_name: string
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          disbursed_amount?: number | null
          disbursed_at?: string | null
          email?: string | null
          emi?: number | null
          employer_name?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          existing_emi?: number | null
          id?: string
          lender_id?: string | null
          loan_product_id?: string | null
          loan_type: Database["public"]["Enums"]["loan_type"]
          monthly_income?: number | null
          notes?: string | null
          pan?: string | null
          phone?: string | null
          purpose?: string | null
          rejection_reason?: string | null
          requested_amount: number
          roi?: number | null
          sanctioned_amount?: number | null
          source?: string | null
          stage?: Database["public"]["Enums"]["loan_stage"]
          tenure_months?: number | null
          updated_at?: string
        }
        Update: {
          applicant_name?: string
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          disbursed_amount?: number | null
          disbursed_at?: string | null
          email?: string | null
          emi?: number | null
          employer_name?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          existing_emi?: number | null
          id?: string
          lender_id?: string | null
          loan_product_id?: string | null
          loan_type?: Database["public"]["Enums"]["loan_type"]
          monthly_income?: number | null
          notes?: string | null
          pan?: string | null
          phone?: string | null
          purpose?: string | null
          rejection_reason?: string | null
          requested_amount?: number
          roi?: number | null
          sanctioned_amount?: number | null
          source?: string | null
          stage?: Database["public"]["Enums"]["loan_stage"]
          tenure_months?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_applications_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_loan_product_id_fkey"
            columns: ["loan_product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_commissions: {
        Row: {
          agent_id: string | null
          application_id: string
          created_at: string
          disbursed_amount: number
          expected_amount: number
          id: string
          invoice_no: string | null
          lender_id: string | null
          notes: string | null
          payout_pct: number
          received_amount: number | null
          received_at: string | null
          status: Database["public"]["Enums"]["commission_status"]
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          application_id: string
          created_at?: string
          disbursed_amount: number
          expected_amount: number
          id?: string
          invoice_no?: string | null
          lender_id?: string | null
          notes?: string | null
          payout_pct: number
          received_amount?: number | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          application_id?: string
          created_at?: string
          disbursed_amount?: number
          expected_amount?: number
          id?: string
          invoice_no?: string | null
          lender_id?: string | null
          notes?: string | null
          payout_pct?: number
          received_amount?: number | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_commissions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_commissions_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_documents: {
        Row: {
          application_id: string
          created_at: string
          doc_type: Database["public"]["Enums"]["doc_type"]
          file_name: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string | null
          updated_at: string
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          doc_type: Database["public"]["Enums"]["doc_type"]
          file_name?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["doc_type"]
          file_name?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_products: {
        Row: {
          active: boolean
          created_at: string
          id: string
          lender_id: string
          max_amount: number | null
          max_tenure_months: number | null
          min_amount: number | null
          min_tenure_months: number | null
          name: string
          payout_pct: number | null
          processing_fee_pct: number | null
          product_type: Database["public"]["Enums"]["loan_type"]
          roi_max: number | null
          roi_min: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          lender_id: string
          max_amount?: number | null
          max_tenure_months?: number | null
          min_amount?: number | null
          min_tenure_months?: number | null
          name: string
          payout_pct?: number | null
          processing_fee_pct?: number | null
          product_type: Database["public"]["Enums"]["loan_type"]
          roi_max?: number | null
          roi_min?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          lender_id?: string
          max_amount?: number | null
          max_tenure_months?: number | null
          min_amount?: number | null
          min_tenure_months?: number | null
          name?: string
          payout_pct?: number | null
          processing_fee_pct?: number | null
          product_type?: Database["public"]["Enums"]["loan_type"]
          roi_max?: number | null
          roi_min?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_products_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          contact_id: string | null
          created_at: string
          description: string | null
          ends_at: string
          id: string
          industry_group: string | null
          lead_id: string | null
          location: string | null
          meeting_url: string | null
          notes: string | null
          organizer: string | null
          participants: string[] | null
          starts_at: string
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          organizer?: string | null
          participants?: string[] | null
          starts_at: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          organizer?: string | null
          participants?: string[] | null
          starts_at?: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      module_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          kind: string
          label: string | null
          module_key: string
          sort_order: number
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          label?: string | null
          module_key: string
          sort_order?: number
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          label?: string | null
          module_key?: string
          sort_order?: number
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pack_agent_runs: {
        Row: {
          agent_key: string
          created_at: string
          created_by: string | null
          group_slug: string
          id: string
          input: Json
          output: string | null
          pack_slug: string
          record_id: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          agent_key: string
          created_at?: string
          created_by?: string | null
          group_slug: string
          id?: string
          input?: Json
          output?: string | null
          pack_slug: string
          record_id?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          agent_key?: string
          created_at?: string
          created_by?: string | null
          group_slug?: string
          id?: string
          input?: Json
          output?: string | null
          pack_slug?: string
          record_id?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pack_agent_runs_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "pack_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_agent_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_agent_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_ai_training: {
        Row: {
          created_at: string
          created_by: string | null
          examples: Json
          glossary: string | null
          group_slug: string
          id: string
          pack_slug: string
          tenant_id: string
          tone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          examples?: Json
          glossary?: string | null
          group_slug: string
          id?: string
          pack_slug: string
          tenant_id: string
          tone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          examples?: Json
          glossary?: string | null
          group_slug?: string
          id?: string
          pack_slug?: string
          tenant_id?: string
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_ai_training_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_ai_training_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_configs: {
        Row: {
          agents: Json | null
          archived_at: string | null
          created_at: string
          description: string | null
          fields: Json | null
          gradient: string | null
          group_slug: string
          id: string
          is_custom: boolean
          kpi_labels: Json | null
          lost_stages: Json | null
          name: string | null
          pack_slug: string
          party_label: string | null
          record_label: string | null
          record_label_plural: string | null
          stages: Json | null
          tagline: string | null
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
          value_label: string | null
          verifications: Json | null
          won_stages: Json | null
        }
        Insert: {
          agents?: Json | null
          archived_at?: string | null
          created_at?: string
          description?: string | null
          fields?: Json | null
          gradient?: string | null
          group_slug: string
          id?: string
          is_custom?: boolean
          kpi_labels?: Json | null
          lost_stages?: Json | null
          name?: string | null
          pack_slug: string
          party_label?: string | null
          record_label?: string | null
          record_label_plural?: string | null
          stages?: Json | null
          tagline?: string | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value_label?: string | null
          verifications?: Json | null
          won_stages?: Json | null
        }
        Update: {
          agents?: Json | null
          archived_at?: string | null
          created_at?: string
          description?: string | null
          fields?: Json | null
          gradient?: string | null
          group_slug?: string
          id?: string
          is_custom?: boolean
          kpi_labels?: Json | null
          lost_stages?: Json | null
          name?: string | null
          pack_slug?: string
          party_label?: string | null
          record_label?: string | null
          record_label_plural?: string | null
          stages?: Json | null
          tagline?: string | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value_label?: string | null
          verifications?: Json | null
          won_stages?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pack_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_documents: {
        Row: {
          created_at: string
          doc_type: string
          id: string
          name: string
          notes: string | null
          record_id: string
          status: string
          storage_path: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type?: string
          id?: string
          name: string
          notes?: string | null
          record_id: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          id?: string
          name?: string
          notes?: string | null
          record_id?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pack_documents_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "pack_records"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_payments: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          decision_note: string | null
          due_date: string | null
          id: string
          kind: string
          label: string
          method: string | null
          paid_at: string | null
          payer_note: string | null
          record_id: string
          reference: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          decision_note?: string | null
          due_date?: string | null
          id?: string
          kind?: string
          label: string
          method?: string | null
          paid_at?: string | null
          payer_note?: string | null
          record_id: string
          reference?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          decision_note?: string | null
          due_date?: string | null
          id?: string
          kind?: string
          label?: string
          method?: string | null
          paid_at?: string | null
          payer_note?: string | null
          record_id?: string
          reference?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_payments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "pack_records"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_records: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          channel_id: string | null
          city: string | null
          closed_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          fields: Json
          group_slug: string
          id: string
          lead_id: string | null
          next_action_at: string | null
          notes: string | null
          owner_id: string | null
          pack_slug: string
          priority: string
          source: string | null
          stage: string
          tenant_id: string | null
          title: string
          updated_at: string
          value: number | null
          won: boolean | null
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          channel_id?: string | null
          city?: string | null
          closed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          fields?: Json
          group_slug: string
          id?: string
          lead_id?: string | null
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          pack_slug: string
          priority?: string
          source?: string | null
          stage: string
          tenant_id?: string | null
          title: string
          updated_at?: string
          value?: number | null
          won?: boolean | null
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          channel_id?: string | null
          city?: string | null
          closed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          fields?: Json
          group_slug?: string
          id?: string
          lead_id?: string | null
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          pack_slug?: string
          priority?: string
          source?: string | null
          stage?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
          value?: number | null
          won?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pack_records_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "lead_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_records_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "lead_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_records_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_accounts: {
        Row: {
          account_number: string | null
          affiliate_id: string | null
          balance: number
          bank_name: string | null
          channel_partner_id: string | null
          created_at: string
          holder_name: string
          id: string
          ifsc: string | null
          is_default: boolean
          is_demo: boolean
          updated_at: string
          upi_id: string | null
          user_id: string
        }
        Insert: {
          account_number?: string | null
          affiliate_id?: string | null
          balance?: number
          bank_name?: string | null
          channel_partner_id?: string | null
          created_at?: string
          holder_name: string
          id?: string
          ifsc?: string | null
          is_default?: boolean
          is_demo?: boolean
          updated_at?: string
          upi_id?: string | null
          user_id: string
        }
        Update: {
          account_number?: string | null
          affiliate_id?: string | null
          balance?: number
          bank_name?: string | null
          channel_partner_id?: string | null
          created_at?: string
          holder_name?: string
          id?: string
          ifsc?: string | null
          is_default?: boolean
          is_demo?: boolean
          updated_at?: string
          upi_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_accounts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_accounts_channel_partner_id_fkey"
            columns: ["channel_partner_id"]
            isOneToOne: false
            referencedRelation: "re_channel_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_transfers: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          id: string
          note: string | null
          payout_request_id: string | null
          re_commission_id: string | null
          sent_by: string | null
          utr: string | null
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          payout_request_id?: string | null
          re_commission_id?: string | null
          sent_by?: string | null
          utr?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          payout_request_id?: string | null
          re_commission_id?: string | null
          sent_by?: string | null
          utr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_transfers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "payout_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_transfers_payout_request_id_fkey"
            columns: ["payout_request_id"]
            isOneToOne: false
            referencedRelation: "affiliate_payout_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_transfers_re_commission_id_fkey"
            columns: ["re_commission_id"]
            isOneToOne: true
            referencedRelation: "re_commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          description: string | null
          enabled: boolean
          feature_key: string
          id: string
          numeric_limit: number | null
          plan: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          feature_key: string
          id?: string
          numeric_limit?: number | null
          plan: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          feature_key?: string
          id?: string
          numeric_limit?: number | null
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          designation: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          designation?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          designation?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proposal_events: {
        Row: {
          actor_id: string | null
          created_at: string
          description: string | null
          event_type: string
          id: string
          lead_id: string | null
          metadata: Json
          proposal_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          lead_id?: string | null
          metadata?: Json
          proposal_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          lead_id?: string | null
          metadata?: Json
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          default_value: number | null
          description: string | null
          group_slug: string | null
          id: string
          industry: string | null
          is_shared: boolean
          name: string
          pack_slug: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          default_value?: number | null
          description?: string | null
          group_slug?: string | null
          id?: string
          industry?: string | null
          is_shared?: boolean
          name: string
          pack_slug?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          default_value?: number | null
          description?: string | null
          group_slug?: string | null
          id?: string
          industry?: string | null
          is_shared?: boolean
          name?: string
          pack_slug?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_versions: {
        Row: {
          ai_content: string | null
          changed_by: string | null
          created_at: string
          description: string | null
          id: string
          notes: string | null
          proposal_id: string
          stage: string | null
          title: string
          value: number | null
          version: number
        }
        Insert: {
          ai_content?: string | null
          changed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          proposal_id: string
          stage?: string | null
          title: string
          value?: number | null
          version: number
        }
        Update: {
          ai_content?: string | null
          changed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          proposal_id?: string
          stage?: string | null
          title?: string
          value?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_versions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          ai_content: string | null
          approval_notes: string | null
          approval_requested_at: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          close_date: string | null
          company_id: string | null
          contact_id: string | null
          converted_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          group_slug: string | null
          id: string
          industry_group: string | null
          lead_id: string | null
          notes: string | null
          owner_id: string | null
          pack_record_id: string | null
          pack_slug: string | null
          probability: number
          reviewed_at: string | null
          sent_at: string | null
          stage: string
          tenant_id: string | null
          title: string
          updated_at: string
          value: number
          version: number
        }
        Insert: {
          ai_content?: string | null
          approval_notes?: string | null
          approval_requested_at?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          group_slug?: string | null
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          notes?: string | null
          owner_id?: string | null
          pack_record_id?: string | null
          pack_slug?: string | null
          probability?: number
          reviewed_at?: string | null
          sent_at?: string | null
          stage?: string
          tenant_id?: string | null
          title: string
          updated_at?: string
          value?: number
          version?: number
        }
        Update: {
          ai_content?: string | null
          approval_notes?: string | null
          approval_requested_at?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          group_slug?: string | null
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          notes?: string | null
          owner_id?: string | null
          pack_record_id?: string | null
          pack_slug?: string | null
          probability?: number
          reviewed_at?: string | null
          sent_at?: string | null
          stage?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
          value?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_pack_record_id_fkey"
            columns: ["pack_record_id"]
            isOneToOne: false
            referencedRelation: "pack_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ps_commissions: {
        Row: {
          base_amount: number
          commission_amount: number
          commission_pct: number
          created_at: string
          id: string
          order_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_amount?: number
          commission_amount?: number
          commission_pct?: number
          created_at?: string
          id?: string
          order_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_amount?: number
          commission_amount?: number
          commission_pct?: number
          created_at?: string
          id?: string
          order_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ps_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ps_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ps_order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "ps_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ps_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ps_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ps_products"
            referencedColumns: ["id"]
          },
        ]
      }
      ps_orders: {
        Row: {
          assigned_to: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          discount: number
          id: string
          kind: string
          notes: string | null
          order_no: string
          owner_id: string | null
          status: string
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          discount?: number
          id?: string
          kind?: string
          notes?: string | null
          order_no?: string
          owner_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount?: number
          id?: string
          kind?: string
          notes?: string | null
          order_no?: string
          owner_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      ps_products: {
        Row: {
          active: boolean
          category: string | null
          commission_pct: number
          cost: number | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string | null
          price: number
          sku: string
          stock: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          commission_pct?: number
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string | null
          price?: number
          sku: string
          stock?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          commission_pct?: number
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          price?: number
          sku?: string
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      re_assignment_rules: {
        Row: {
          active: boolean
          agent_id: string | null
          budget_max: number | null
          budget_min: number | null
          city: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          priority: number
          segment: string | null
          team: string
        }
        Insert: {
          active?: boolean
          agent_id?: string | null
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          priority?: number
          segment?: string | null
          team: string
        }
        Update: {
          active?: boolean
          agent_id?: string | null
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          priority?: number
          segment?: string | null
          team?: string
        }
        Relationships: []
      }
      re_booking_docs: {
        Row: {
          created_at: string
          deal_id: string
          doc_type: string
          error: string | null
          id: string
          identifier_masked: string | null
          provider: string | null
          result: Json
          status: string
          submitted_by: string | null
          updated_at: string
          verification_id: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          doc_type: string
          error?: string | null
          id?: string
          identifier_masked?: string | null
          provider?: string | null
          result?: Json
          status?: string
          submitted_by?: string | null
          updated_at?: string
          verification_id?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          doc_type?: string
          error?: string | null
          id?: string
          identifier_masked?: string | null
          provider?: string | null
          result?: Json
          status?: string
          submitted_by?: string | null
          updated_at?: string
          verification_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_booking_docs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "re_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      re_channel_partners: {
        Row: {
          city: string | null
          commission_pct: number
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          owner_id: string
          phone: string | null
          rera_number: string | null
          specialization: string | null
        }
        Insert: {
          city?: string | null
          commission_pct?: number
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          owner_id?: string
          phone?: string | null
          rera_number?: string | null
          specialization?: string | null
        }
        Update: {
          city?: string | null
          commission_pct?: number
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          owner_id?: string
          phone?: string | null
          rera_number?: string | null
          specialization?: string | null
        }
        Relationships: []
      }
      re_clients: {
        Row: {
          agent_id: string | null
          ai_score: number | null
          ai_score_reason: string | null
          alt_phone: string | null
          assigned_team: string | null
          bhk: number | null
          budget_max: number | null
          budget_min: number | null
          channel_partner_id: string | null
          created_at: string | null
          down_payment: number | null
          email: string | null
          full_name: string
          id: string
          intent: string | null
          kyc_documents: Json | null
          kyc_status: string | null
          last_contacted_at: string | null
          loan_required: boolean | null
          lost_reason: string | null
          occupation: string | null
          owner_id: string | null
          phone: string | null
          possession_pref: string | null
          preferred_city: string | null
          preferred_location: string | null
          preferred_type: string | null
          purpose: string | null
          referred_by: string | null
          requirement: string | null
          segment: string | null
          size_min: number | null
          source: string | null
          status: string
          temperature: string | null
          timeline_days: number | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          agent_id?: string | null
          ai_score?: number | null
          ai_score_reason?: string | null
          alt_phone?: string | null
          assigned_team?: string | null
          bhk?: number | null
          budget_max?: number | null
          budget_min?: number | null
          channel_partner_id?: string | null
          created_at?: string | null
          down_payment?: number | null
          email?: string | null
          full_name: string
          id?: string
          intent?: string | null
          kyc_documents?: Json | null
          kyc_status?: string | null
          last_contacted_at?: string | null
          loan_required?: boolean | null
          lost_reason?: string | null
          occupation?: string | null
          owner_id?: string | null
          phone?: string | null
          possession_pref?: string | null
          preferred_city?: string | null
          preferred_location?: string | null
          preferred_type?: string | null
          purpose?: string | null
          referred_by?: string | null
          requirement?: string | null
          segment?: string | null
          size_min?: number | null
          source?: string | null
          status?: string
          temperature?: string | null
          timeline_days?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          agent_id?: string | null
          ai_score?: number | null
          ai_score_reason?: string | null
          alt_phone?: string | null
          assigned_team?: string | null
          bhk?: number | null
          budget_max?: number | null
          budget_min?: number | null
          channel_partner_id?: string | null
          created_at?: string | null
          down_payment?: number | null
          email?: string | null
          full_name?: string
          id?: string
          intent?: string | null
          kyc_documents?: Json | null
          kyc_status?: string | null
          last_contacted_at?: string | null
          loan_required?: boolean | null
          lost_reason?: string | null
          occupation?: string | null
          owner_id?: string | null
          phone?: string | null
          possession_pref?: string | null
          preferred_city?: string | null
          preferred_location?: string | null
          preferred_type?: string | null
          purpose?: string | null
          referred_by?: string | null
          requirement?: string | null
          segment?: string | null
          size_min?: number | null
          source?: string | null
          status?: string
          temperature?: string | null
          timeline_days?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      re_commissions: {
        Row: {
          amount: number | null
          booking_value: number
          created_at: string
          deal_id: string
          id: string
          owner_id: string
          paid_on: string | null
          partner_id: string
          pct: number
          reference: string | null
          status: string
          tds_pct: number
        }
        Insert: {
          amount?: number | null
          booking_value: number
          created_at?: string
          deal_id: string
          id?: string
          owner_id?: string
          paid_on?: string | null
          partner_id: string
          pct: number
          reference?: string | null
          status?: string
          tds_pct?: number
        }
        Update: {
          amount?: number | null
          booking_value?: number
          created_at?: string
          deal_id?: string
          id?: string
          owner_id?: string
          paid_on?: string | null
          partner_id?: string
          pct?: number
          reference?: string | null
          status?: string
          tds_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "re_commissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "re_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_commissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "re_channel_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      re_deals: {
        Row: {
          agent_id: string | null
          booking_date: string | null
          buyer_email: string | null
          buyer_user_id: string | null
          channel_partner_id: string | null
          client_id: string | null
          closed_at: string | null
          created_at: string | null
          doc_status: string
          expected_value: number | null
          final_value: number | null
          id: string
          lost_reason: string | null
          next_action_at: string | null
          notes: string | null
          owner_id: string | null
          property_id: string | null
          stage: string
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          booking_date?: string | null
          buyer_email?: string | null
          buyer_user_id?: string | null
          channel_partner_id?: string | null
          client_id?: string | null
          closed_at?: string | null
          created_at?: string | null
          doc_status?: string
          expected_value?: number | null
          final_value?: number | null
          id?: string
          lost_reason?: string | null
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          property_id?: string | null
          stage?: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          booking_date?: string | null
          buyer_email?: string | null
          buyer_user_id?: string | null
          channel_partner_id?: string | null
          client_id?: string | null
          closed_at?: string | null
          created_at?: string | null
          doc_status?: string
          expected_value?: number | null
          final_value?: number | null
          id?: string
          lost_reason?: string | null
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          property_id?: string | null
          stage?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "re_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "re_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      re_followups: {
        Row: {
          client_id: string
          created_at: string
          done: boolean
          due_at: string
          id: string
          kind: string
          notes: string | null
          owner_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          done?: boolean
          due_at: string
          id?: string
          kind?: string
          notes?: string | null
          owner_id?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          done?: boolean
          due_at?: string
          id?: string
          kind?: string
          notes?: string | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_followups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "re_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      re_loans: {
        Row: {
          amount: number | null
          bank: string
          client_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          notes: string | null
          officer: string | null
          owner_id: string
          status: string
        }
        Insert: {
          amount?: number | null
          bank: string
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          notes?: string | null
          officer?: string | null
          owner_id?: string
          status?: string
        }
        Update: {
          amount?: number | null
          bank?: string
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          notes?: string | null
          officer?: string | null
          owner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_loans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "re_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_loans_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "re_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      re_negotiations: {
        Row: {
          approval_level: string
          created_at: string
          customer_offer: number | null
          deal_id: string
          decided_at: string | null
          decided_by: string | null
          discount_pct: number | null
          final_price: number
          id: string
          list_price: number
          note: string | null
          owner_id: string
          seller_quote: number | null
          status: string
        }
        Insert: {
          approval_level?: string
          created_at?: string
          customer_offer?: number | null
          deal_id: string
          decided_at?: string | null
          decided_by?: string | null
          discount_pct?: number | null
          final_price: number
          id?: string
          list_price: number
          note?: string | null
          owner_id?: string
          seller_quote?: number | null
          status?: string
        }
        Update: {
          approval_level?: string
          created_at?: string
          customer_offer?: number | null
          deal_id?: string
          decided_at?: string | null
          decided_by?: string | null
          discount_pct?: number | null
          final_price?: number
          id?: string
          list_price?: number
          note?: string | null
          owner_id?: string
          seller_quote?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_negotiations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "re_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      re_payment_schedule: {
        Row: {
          amount: number
          created_at: string
          deal_id: string
          due_date: string
          id: string
          milestone: string
          owner_id: string
          paid_amount: number
          paid_on: string | null
          reference: string | null
          reported_amount: number | null
          reported_at: string | null
          reported_reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          deal_id: string
          due_date: string
          id?: string
          milestone: string
          owner_id?: string
          paid_amount?: number
          paid_on?: string | null
          reference?: string | null
          reported_amount?: number | null
          reported_at?: string | null
          reported_reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          deal_id?: string
          due_date?: string
          id?: string
          milestone?: string
          owner_id?: string
          paid_amount?: number
          paid_on?: string | null
          reference?: string | null
          reported_amount?: number | null
          reported_at?: string | null
          reported_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_payment_schedule_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "re_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      re_projects: {
        Row: {
          address: string | null
          amenities: string | null
          brochure_url: string | null
          city: string | null
          created_at: string
          developer: string | null
          floors: number | null
          id: string
          location: string | null
          name: string
          owner_id: string
          payment_plans: string | null
          possession_date: string | null
          price_max: number | null
          price_min: number | null
          project_type: string | null
          rera_number: string | null
          total_units: number | null
          towers: number | null
        }
        Insert: {
          address?: string | null
          amenities?: string | null
          brochure_url?: string | null
          city?: string | null
          created_at?: string
          developer?: string | null
          floors?: number | null
          id?: string
          location?: string | null
          name: string
          owner_id?: string
          payment_plans?: string | null
          possession_date?: string | null
          price_max?: number | null
          price_min?: number | null
          project_type?: string | null
          rera_number?: string | null
          total_units?: number | null
          towers?: number | null
        }
        Update: {
          address?: string | null
          amenities?: string | null
          brochure_url?: string | null
          city?: string | null
          created_at?: string
          developer?: string | null
          floors?: number | null
          id?: string
          location?: string | null
          name?: string
          owner_id?: string
          payment_plans?: string | null
          possession_date?: string | null
          price_max?: number | null
          price_min?: number | null
          project_type?: string | null
          rera_number?: string | null
          total_units?: number | null
          towers?: number | null
        }
        Relationships: []
      }
      re_properties: {
        Row: {
          address: string | null
          area_sqft: number | null
          bathrooms: number | null
          bedrooms: number | null
          bhk: number | null
          carpet_area: number | null
          city: string | null
          construction_status: string | null
          created_at: string | null
          description: string | null
          facing: string | null
          floor_no: number | null
          furnishing: string | null
          highlights: string | null
          id: string
          images: Json | null
          inventory_status: string
          listing_type: string
          location: string | null
          owner_id: string | null
          parking: number | null
          possession_date: string | null
          price: number | null
          project_id: string | null
          property_type: string | null
          rera_number: string | null
          status: string | null
          super_area: number | null
          title: string
          tower: string | null
          unit_no: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          area_sqft?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          bhk?: number | null
          carpet_area?: number | null
          city?: string | null
          construction_status?: string | null
          created_at?: string | null
          description?: string | null
          facing?: string | null
          floor_no?: number | null
          furnishing?: string | null
          highlights?: string | null
          id?: string
          images?: Json | null
          inventory_status?: string
          listing_type?: string
          location?: string | null
          owner_id?: string | null
          parking?: number | null
          possession_date?: string | null
          price?: number | null
          project_id?: string | null
          property_type?: string | null
          rera_number?: string | null
          status?: string | null
          super_area?: number | null
          title: string
          tower?: string | null
          unit_no?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          area_sqft?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          bhk?: number | null
          carpet_area?: number | null
          city?: string | null
          construction_status?: string | null
          created_at?: string | null
          description?: string | null
          facing?: string | null
          floor_no?: number | null
          furnishing?: string | null
          highlights?: string | null
          id?: string
          images?: Json | null
          inventory_status?: string
          listing_type?: string
          location?: string | null
          owner_id?: string | null
          parking?: number | null
          possession_date?: string | null
          price?: number | null
          project_id?: string | null
          property_type?: string | null
          rera_number?: string | null
          status?: string | null
          super_area?: number | null
          title?: string
          tower?: string | null
          unit_no?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_properties_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "re_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      re_site_visits: {
        Row: {
          agent_name: string | null
          ai_summary: string | null
          checkin_at: string | null
          checkin_method: string | null
          checkout_at: string | null
          client_id: string | null
          created_at: string
          feedback: Json | null
          id: string
          interest: number | null
          lat: number | null
          lng: number | null
          meeting_point: string | null
          next_action: string | null
          notes: string | null
          owner_id: string
          project_id: string | null
          property_id: string | null
          scheduled_at: string
          status: string
        }
        Insert: {
          agent_name?: string | null
          ai_summary?: string | null
          checkin_at?: string | null
          checkin_method?: string | null
          checkout_at?: string | null
          client_id?: string | null
          created_at?: string
          feedback?: Json | null
          id?: string
          interest?: number | null
          lat?: number | null
          lng?: number | null
          meeting_point?: string | null
          next_action?: string | null
          notes?: string | null
          owner_id?: string
          project_id?: string | null
          property_id?: string | null
          scheduled_at: string
          status?: string
        }
        Update: {
          agent_name?: string | null
          ai_summary?: string | null
          checkin_at?: string | null
          checkin_method?: string | null
          checkout_at?: string | null
          client_id?: string | null
          created_at?: string
          feedback?: Json | null
          id?: string
          interest?: number | null
          lat?: number | null
          lng?: number | null
          meeting_point?: string | null
          next_action?: string | null
          notes?: string | null
          owner_id?: string
          project_id?: string | null
          property_id?: string | null
          scheduled_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "re_site_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "re_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_site_visits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "re_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_site_visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "re_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rest_actions: {
        Row: {
          created_at: string
          due_on: string
          guest_id: string | null
          id: string
          kind: string
          message: string | null
          priority: number
          reason: string | null
          source: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          due_on?: string
          guest_id?: string | null
          id?: string
          kind: string
          message?: string | null
          priority?: number
          reason?: string | null
          source?: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          due_on?: string
          guest_id?: string | null
          id?: string
          kind?: string
          message?: string | null
          priority?: number
          reason?: string | null
          source?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rest_actions_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "rest_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rest_guests: {
        Row: {
          anniversary: string | null
          birthday: string | null
          created_at: string
          email: string | null
          favourite_dishes: string | null
          home_outlet_id: string | null
          id: string
          last_visit_at: string | null
          loyalty_points: number
          name: string
          phone: string | null
          preferences: string | null
          tenant_id: string
          tier: string
          total_spend: number
          visits: number
        }
        Insert: {
          anniversary?: string | null
          birthday?: string | null
          created_at?: string
          email?: string | null
          favourite_dishes?: string | null
          home_outlet_id?: string | null
          id?: string
          last_visit_at?: string | null
          loyalty_points?: number
          name: string
          phone?: string | null
          preferences?: string | null
          tenant_id: string
          tier?: string
          total_spend?: number
          visits?: number
        }
        Update: {
          anniversary?: string | null
          birthday?: string | null
          created_at?: string
          email?: string | null
          favourite_dishes?: string | null
          home_outlet_id?: string | null
          id?: string
          last_visit_at?: string | null
          loyalty_points?: number
          name?: string
          phone?: string | null
          preferences?: string | null
          tenant_id?: string
          tier?: string
          total_spend?: number
          visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "rest_guests_home_outlet_id_fkey"
            columns: ["home_outlet_id"]
            isOneToOne: false
            referencedRelation: "rest_outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_guests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_guests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rest_loyalty: {
        Row: {
          created_at: string
          guest_id: string
          id: string
          order_id: string | null
          points: number
          reason: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          guest_id: string
          id?: string
          order_id?: string | null
          points: number
          reason?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          guest_id?: string
          id?: string
          order_id?: string | null
          points?: number
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rest_loyalty_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "rest_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_loyalty_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "rest_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_loyalty_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_loyalty_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rest_orders: {
        Row: {
          amount: number
          channel: string
          covers: number | null
          created_at: string
          guest_id: string | null
          id: string
          items: string | null
          ordered_at: string
          outlet_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          channel?: string
          covers?: number | null
          created_at?: string
          guest_id?: string | null
          id?: string
          items?: string | null
          ordered_at?: string
          outlet_id?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          channel?: string
          covers?: number | null
          created_at?: string
          guest_id?: string | null
          id?: string
          items?: string | null
          ordered_at?: string
          outlet_id?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rest_orders_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "rest_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_orders_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "rest_outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rest_outlets: {
        Row: {
          city: string | null
          created_at: string
          id: string
          manager: string | null
          monthly_target: number
          name: string
          seats: number
          tenant_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          manager?: string | null
          monthly_target?: number
          name: string
          seats?: number
          tenant_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          manager?: string | null
          monthly_target?: number
          name?: string
          seats?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rest_outlets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_outlets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rest_reservations: {
        Row: {
          created_at: string
          guest_id: string | null
          guest_name: string
          id: string
          notes: string | null
          occasion: string | null
          outlet_id: string | null
          party_size: number
          phone: string | null
          reserved_for: string
          source: string | null
          status: string
          table_no: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          guest_id?: string | null
          guest_name: string
          id?: string
          notes?: string | null
          occasion?: string | null
          outlet_id?: string | null
          party_size?: number
          phone?: string | null
          reserved_for: string
          source?: string | null
          status?: string
          table_no?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          guest_id?: string | null
          guest_name?: string
          id?: string
          notes?: string | null
          occasion?: string | null
          outlet_id?: string | null
          party_size?: number
          phone?: string | null
          reserved_for?: string
          source?: string | null
          status?: string
          table_no?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rest_reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "rest_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_reservations_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "rest_outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rest_reviews: {
        Row: {
          comment: string | null
          created_at: string
          guest_id: string | null
          id: string
          outlet_id: string | null
          platform: string
          rating: number
          replied_at: string | null
          reply: string | null
          reviewer: string | null
          tenant_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          guest_id?: string | null
          id?: string
          outlet_id?: string | null
          platform?: string
          rating: number
          replied_at?: string | null
          reply?: string | null
          reviewer?: string | null
          tenant_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          guest_id?: string | null
          id?: string
          outlet_id?: string | null
          platform?: string
          rating?: number
          replied_at?: string | null
          reply?: string | null
          reviewer?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rest_reviews_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "rest_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_reviews_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "rest_outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rest_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_sync_configs: {
        Row: {
          column_mapping: Json
          created_at: string
          created_by: string | null
          group_slug: string | null
          id: string
          is_enabled: boolean
          last_row_count: number | null
          last_run_at: string | null
          last_status: string | null
          name: string
          pack_slug: string | null
          range_a1: string
          spreadsheet_id: string
          sync_interval: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          column_mapping?: Json
          created_at?: string
          created_by?: string | null
          group_slug?: string | null
          id?: string
          is_enabled?: boolean
          last_row_count?: number | null
          last_run_at?: string | null
          last_status?: string | null
          name: string
          pack_slug?: string | null
          range_a1: string
          spreadsheet_id: string
          sync_interval?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          column_mapping?: Json
          created_at?: string
          created_by?: string | null
          group_slug?: string | null
          id?: string
          is_enabled?: boolean
          last_row_count?: number | null
          last_run_at?: string | null
          last_status?: string | null
          name?: string
          pack_slug?: string | null
          range_a1?: string
          spreadsheet_id?: string
          sync_interval?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_sync_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheet_sync_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_policies: {
        Row: {
          first_response_mins: number
          id: string
          priority: string
          resolve_mins: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          first_response_mins: number
          id?: string
          priority: string
          resolve_mins: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          first_response_mins?: number
          id?: string
          priority?: string
          resolve_mins?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assignee_id: string | null
          channel: string
          created_at: string
          created_by: string | null
          description: string | null
          first_response_at: string | null
          id: string
          industry_group: string | null
          linked_lead_id: string | null
          priority: string
          requester_email: string
          requester_name: string | null
          resolved_at: string | null
          sla_breached: boolean
          sla_due_at: string | null
          status: string
          subject: string
          tags: string[] | null
          tenant_id: string | null
          ticket_number: number
          updated_at: string
          urgency: string
        }
        Insert: {
          assignee_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          first_response_at?: string | null
          id?: string
          industry_group?: string | null
          linked_lead_id?: string | null
          priority?: string
          requester_email: string
          requester_name?: string | null
          resolved_at?: string | null
          sla_breached?: boolean
          sla_due_at?: string | null
          status?: string
          subject: string
          tags?: string[] | null
          tenant_id?: string | null
          ticket_number?: number
          updated_at?: string
          urgency?: string
        }
        Update: {
          assignee_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          first_response_at?: string | null
          id?: string
          industry_group?: string | null
          linked_lead_id?: string | null
          priority?: string
          requester_email?: string
          requester_name?: string | null
          resolved_at?: string | null
          sla_breached?: boolean
          sla_due_at?: string | null
          status?: string
          subject?: string
          tags?: string[] | null
          tenant_id?: string | null
          ticket_number?: number
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          attachments: Json
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          industry_group: string | null
          lead_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          reminder_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attachments?: Json
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          reminder_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attachments?: Json
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          reminder_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_landing_pages: {
        Row: {
          created_at: string
          cta_label: string | null
          features: Json
          hero_headline: string
          hero_subheadline: string | null
          id: string
          industry: string
          is_published: boolean
          og_image: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          tenant_id: string
          testimonial: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          features?: Json
          hero_headline: string
          hero_subheadline?: string | null
          id?: string
          industry: string
          is_published?: boolean
          og_image?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          tenant_id: string
          testimonial?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          features?: Json
          hero_headline?: string
          hero_subheadline?: string | null
          id?: string
          industry?: string
          is_published?: boolean
          og_image?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          tenant_id?: string
          testimonial?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_landing_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_landing_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_locations: {
        Row: {
          city: string | null
          created_at: string
          id: string
          kind: string
          manager_name: string | null
          manager_phone: string | null
          marketing_fee_pct: number
          name: string
          opened_on: string | null
          royalty_pct: number
          state: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          kind?: string
          manager_name?: string | null
          manager_phone?: string | null
          marketing_fee_pct?: number
          name: string
          opened_on?: string | null
          royalty_pct?: number
          state?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          kind?: string
          manager_name?: string | null
          manager_phone?: string | null
          marketing_fee_pct?: number
          name?: string
          opened_on?: string | null
          royalty_pct?: number
          state?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          member_role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_webhook_secrets: {
        Row: {
          created_at: string
          tenant_id: string
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          created_at?: string
          tenant_id: string
          updated_at?: string
          webhook_secret: string
        }
        Update: {
          created_at?: string
          tenant_id?: string
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_webhook_secrets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_webhook_secrets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_workspaces: {
        Row: {
          business_description: string | null
          created_at: string
          created_by: string | null
          dashboard: Json
          integrations: Json
          location_mode: string
          modules: Json
          reports: Json
          roles: Json
          settings: Json
          subtype: string | null
          template_config: Json | null
          template_slug: string
          tenant_id: string
          updated_at: string
          whatsapp_templates: Json
          workflows: Json
        }
        Insert: {
          business_description?: string | null
          created_at?: string
          created_by?: string | null
          dashboard?: Json
          integrations?: Json
          location_mode?: string
          modules?: Json
          reports?: Json
          roles?: Json
          settings?: Json
          subtype?: string | null
          template_config?: Json | null
          template_slug: string
          tenant_id: string
          updated_at?: string
          whatsapp_templates?: Json
          workflows?: Json
        }
        Update: {
          business_description?: string | null
          created_at?: string
          created_by?: string | null
          dashboard?: Json
          integrations?: Json
          location_mode?: string
          modules?: Json
          reports?: Json
          roles?: Json
          settings?: Json
          subtype?: string | null
          template_config?: Json | null
          template_slug?: string
          tenant_id?: string
          updated_at?: string
          whatsapp_templates?: Json
          workflows?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tenant_workspaces_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_workspaces_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          accent_color: string | null
          created_at: string
          custom_domain: string | null
          favicon_url: string | null
          id: string
          industry: string | null
          is_active: boolean
          is_isolated: boolean
          logo_url: string | null
          name: string
          owner_id: string | null
          plan: string
          primary_color: string | null
          slug: string
          tagline: string | null
          updated_at: string
          webhook_backoff_base_minutes: number
          webhook_backoff_factor: number
          webhook_hmac_enabled: boolean
          webhook_max_attempts: number
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          custom_domain?: string | null
          favicon_url?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          is_isolated?: boolean
          logo_url?: string | null
          name: string
          owner_id?: string | null
          plan?: string
          primary_color?: string | null
          slug: string
          tagline?: string | null
          updated_at?: string
          webhook_backoff_base_minutes?: number
          webhook_backoff_factor?: number
          webhook_hmac_enabled?: boolean
          webhook_max_attempts?: number
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          custom_domain?: string | null
          favicon_url?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          is_isolated?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          plan?: string
          primary_color?: string | null
          slug?: string
          tagline?: string | null
          updated_at?: string
          webhook_backoff_base_minutes?: number
          webhook_backoff_factor?: number
          webhook_hmac_enabled?: boolean
          webhook_max_attempts?: number
        }
        Relationships: []
      }
      ticket_macros: {
        Row: {
          actions: Json
          body: string | null
          created_at: string
          id: string
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          actions?: Json
          body?: string | null
          created_at?: string
          id?: string
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          actions?: Json
          body?: string | null
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_macros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_macros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_replies: {
        Row: {
          attachments: Json | null
          author_email: string | null
          author_id: string | null
          author_name: string | null
          body: string
          created_at: string
          id: string
          is_public: boolean
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          author_email?: string | null
          author_id?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          is_public?: boolean
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          author_email?: string | null
          author_id?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          is_public?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_industry_access: {
        Row: {
          created_at: string
          id: string
          industry_group: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          industry_group: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          industry_group?: string
          user_id?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      verifications: {
        Row: {
          created_at: string
          error: string | null
          id: string
          identifier_masked: string | null
          kind: string
          lead_id: string | null
          provider: string
          record_id: string | null
          requested_by: string | null
          result: Json
          score: number | null
          status: string
          subject_name: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          identifier_masked?: string | null
          kind: string
          lead_id?: string | null
          provider?: string
          record_id?: string | null
          requested_by?: string | null
          result?: Json
          score?: number | null
          status?: string
          subject_name?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          identifier_masked?: string | null
          kind?: string
          lead_id?: string | null
          provider?: string
          record_id?: string | null
          requested_by?: string | null
          result?: Json
          score?: number | null
          status?: string
          subject_name?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "pack_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_template_library: {
        Row: {
          based_on: string | null
          created_at: string
          definition: Json
          id: string
          published_at: string | null
          slug: string
          status: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          based_on?: string | null
          created_at?: string
          definition: Json
          id?: string
          published_at?: string | null
          slug: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          based_on?: string | null
          created_at?: string
          definition?: Json
          id?: string
          published_at?: string | null
          slug?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      tenants_public: {
        Row: {
          accent_color: string | null
          favicon_url: string | null
          id: string | null
          industry: string | null
          logo_url: string | null
          name: string | null
          plan: string | null
          primary_color: string | null
          slug: string | null
          tagline: string | null
        }
        Insert: {
          accent_color?: string | null
          favicon_url?: string | null
          id?: string | null
          industry?: string | null
          logo_url?: string | null
          name?: string | null
          plan?: string | null
          primary_color?: string | null
          slug?: string | null
          tagline?: string | null
        }
        Update: {
          accent_color?: string | null
          favicon_url?: string | null
          id?: string | null
          industry?: string | null
          logo_url?: string | null
          name?: string | null
          plan?: string | null
          primary_color?: string | null
          slug?: string | null
          tagline?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_my_tenant: {
        Args: { _industry: string; _name: string }
        Returns: string
      }
      creator_claim_invites: { Args: never; Returns: number }
      creator_my_team_role: { Args: never; Returns: Json }
      dist_portal_claim: { Args: never; Returns: number }
      dist_portal_place_order: {
        Args: { _items: Json; _note?: string; _partner: string }
        Returns: string
      }
      dist_portal_report_payment: {
        Args: {
          _amount: number
          _method: string
          _partner: string
          _reference: string
        }
        Returns: string
      }
      edu_applicant_claim: { Args: never; Returns: number }
      edu_approve_fee_payment: { Args: { _fee: string }; Returns: undefined }
      edu_report_fee_payment: {
        Args: { _amount: number; _fee: string; _ref: string }
        Returns: undefined
      }
      edu_run_fee_agent: { Args: { _tenant: string }; Returns: number }
      fin_can_access: {
        Args: { _owner: string; _tenant: string }
        Returns: boolean
      }
      fin_post: {
        Args: {
          _amt: number
          _cat: string
          _dir: string
          _memo: string
          _method: string
          _owner: string
          _paid: boolean
          _party: string
          _sid: string
          _src: string
          _tenant: string
          _utr: string
        }
        Returns: undefined
      }
      is_tenant_member: {
        Args: { _tenant: string; _user: string }
        Returns: boolean
      }
      re_buyer_claim: { Args: never; Returns: number }
      re_buyer_report_payment: {
        Args: { _amount: number; _id: string; _ref: string }
        Returns: undefined
      }
      run_creator_followups: { Args: never; Returns: Json }
      run_creator_sequences: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "sales_manager" | "sales_executive"
      commission_status: "pending" | "invoiced" | "received" | "cancelled"
      doc_status: "pending" | "uploaded" | "verified" | "rejected"
      doc_type:
        | "pan"
        | "aadhaar"
        | "bank_stmt"
        | "itr"
        | "salary_slip"
        | "form16"
        | "photo"
        | "address_proof"
        | "property_papers"
        | "other"
      employment_type:
        | "salaried"
        | "self_employed"
        | "business"
        | "professional"
        | "retired"
        | "other"
      lead_priority: "low" | "medium" | "high" | "urgent"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal_sent"
        | "negotiation"
        | "won"
        | "lost"
      loan_stage:
        | "new"
        | "docs_pending"
        | "docs_collected"
        | "login"
        | "under_review"
        | "sanctioned"
        | "disbursed"
        | "rejected"
        | "on_hold"
      loan_type:
        | "personal"
        | "home"
        | "business"
        | "lap"
        | "auto"
        | "education"
        | "gold"
      meeting_status: "scheduled" | "completed" | "cancelled" | "no_show"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "done" | "cancelled"
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
      app_role: ["super_admin", "admin", "sales_manager", "sales_executive"],
      commission_status: ["pending", "invoiced", "received", "cancelled"],
      doc_status: ["pending", "uploaded", "verified", "rejected"],
      doc_type: [
        "pan",
        "aadhaar",
        "bank_stmt",
        "itr",
        "salary_slip",
        "form16",
        "photo",
        "address_proof",
        "property_papers",
        "other",
      ],
      employment_type: [
        "salaried",
        "self_employed",
        "business",
        "professional",
        "retired",
        "other",
      ],
      lead_priority: ["low", "medium", "high", "urgent"],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "proposal_sent",
        "negotiation",
        "won",
        "lost",
      ],
      loan_stage: [
        "new",
        "docs_pending",
        "docs_collected",
        "login",
        "under_review",
        "sanctioned",
        "disbursed",
        "rejected",
        "on_hold",
      ],
      loan_type: [
        "personal",
        "home",
        "business",
        "lap",
        "auto",
        "education",
        "gold",
      ],
      meeting_status: ["scheduled", "completed", "cancelled", "no_show"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "done", "cancelled"],
    },
  },
} as const
