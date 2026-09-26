import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { creatorAi, type CreatorAiInput } from "@/lib/creator.functions";

export type Deal = {
  id: string; campaign: string; stage: string; value: number; currency: string;
  platform: string | null; deal_type: string | null; probability: number;
  next_action: string | null; next_action_at: string | null; deadline: string | null;
  start_date: string | null; end_date: string | null; source: string;
  brand_id: string | null; creator_id: string | null; commission_pct: number; gst_pct: number;
  objective: string | null; agency: string | null; campaign_manager: string | null;
  payment_terms: string | null; usage_rights: string | null; exclusivity: string | null;
  requirements: string | null; notes: string | null; approval_token: string;
  created_at: string; updated_at: string;
  creator_brands: { name: string } | null;
  creator_profiles: { display_name: string } | null;
};

export function useDeals() {
  return useQuery({
    queryKey: ["creator", "deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_deals")
        .select("*, creator_brands(name), creator_profiles(display_name)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Deal[];
    },
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ["creator", "brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("creator_brands").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["creator", "profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("creator_profiles").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: ["creator", "invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_invoices")
        .select("*, creator_deals(campaign, platform, creator_brands(name))")
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDeliverables() {
  return useQuery({
    queryKey: ["creator", "deliverables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_deliverables")
        .select("*, creator_deals(campaign)")
        .order("due_date", { nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** The main contact person for a brand, used to fill in pitch recipients. */
export function useBrandContact(brandId: string | null | undefined) {
  return useQuery({
    queryKey: ["creator", "brand-contact", brandId],
    enabled: !!brandId,
    queryFn: async () => {
      const { data, error } = await supabase.from("creator_brand_contacts")
        .select("name,email,phone,whatsapp,linkedin").eq("brand_id", brandId!).order("created_at").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useInvalidateCreator() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["creator"] });
}

export function useCreatorAi() {
  const fn = useServerFn(creatorAi);
  return async (input: CreatorAiInput) => (await fn({ data: input })).text;
}

export function parseAiJson<T = Record<string, unknown>>(text: string): T {
  try { return JSON.parse(text) as T; } catch { return {} as T; }
}
