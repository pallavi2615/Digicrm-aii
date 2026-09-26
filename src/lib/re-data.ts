import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { reAi } from "@/lib/realestate.functions";

export const reDb = supabase as any;

export function useRe<T = any>(table: string, select = "*", order = "created_at", asc = false) {
  return useQuery({
    queryKey: ["re", table, select],
    queryFn: async () => {
      const { data, error } = await reDb.from(table).select(select).order(order, { ascending: asc }).limit(2000);
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}
export function useReInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["re"] });
    ["re-pipeline", "re-clients", "re-props", "re-deals-kpi", "re-clients-kpi", "re-props-kpi"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
}

export async function reRun(p: PromiseLike<{ error: any }>, ok?: string) {
  const { error } = await p;
  if (error) { toast.error(error.message); return false; }
  if (ok) toast.success(ok);
  return true;
}

export function useReAi() {
  const fn = useServerFn(reAi);
  const [loading, setLoading] = useState(false);
  const run = async (data: { mode: "score_lead" | "extract" | "recommend" | "visit_summary" | "copilot" | "whatsapp" | "call_summary" | "forecast"; clientId?: string; text?: string; question?: string }) => {
    setLoading(true);
    try { return (await fn({ data } as any)) as any as { text: string; score?: number; temperature?: string }; }
    catch (e: any) { toast.error(e.message); return null; }
    finally { setLoading(false); }
  };
  return { run, loading };
}

export const INVENTORY = ["Available", "Hold", "Token Received", "Booked", "Sold", "Cancelled"] as const;
export const INV_TONE: Record<string, string> = {
  Available: "bg-success/15 text-success border-success/30",
  Hold: "bg-warning/15 text-warning border-warning/30",
  "Token Received": "bg-info/15 text-info border-info/30",
  Booked: "bg-primary/15 text-primary border-primary/30",
  Sold: "bg-destructive/15 text-destructive border-destructive/30",
  Cancelled: "bg-muted text-muted-foreground border-border",
};
export const SOURCES = ["Website", "Landing page", "Google Ads", "Meta Ads", "Instagram", "WhatsApp", "YouTube", "MagicBricks", "99acres", "Housing.com", "Referral", "Walk-in", "Calling", "Channel Partner", "Existing customer", "Event", "Import"];
export const LOST_REASONS = ["Budget", "Price", "Location", "Competitor", "Loan rejected", "Delayed decision", "No response", "Property unavailable", "Family decision", "Project cancelled"];
export const VISIT_STATUS = ["Scheduled", "Confirmed", "Arrived", "Completed", "Rescheduled", "No Show", "Cancelled"];
export const FOLLOWUP_KINDS = ["Call", "WhatsApp", "Email", "Meeting", "Site visit", "Price negotiation", "Document collection", "Payment reminder"];
export const LOAN_STATUS = ["Applied", "Documents", "Sanctioned", "Disbursed", "Rejected"];
export const TEMP_TONE: Record<string, string> = {
  Hot: "bg-destructive/15 text-destructive border-destructive/30",
  Warm: "bg-warning/15 text-warning border-warning/30",
  Cold: "bg-info/15 text-info border-info/30",
};

export const inr = (n: number) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
export const cr = (n: number) => { n = Number(n) || 0; return Math.abs(n) >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : Math.abs(n) >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : inr(n); };
export const normPhone = (p?: string | null) => (p ?? "").replace(/\D/g, "").slice(-10);
export const waLink = (phone: string | null | undefined, text: string) => {
  const d = normPhone(phone);
  return `https://wa.me/${d ? "91" + d : ""}?text=${encodeURIComponent(text)}`;
};

/** Rule-based match score between a lead requirement and a unit (0–100). */
export function matchScore(req: { budget_min?: number | null; budget_max?: number | null; city?: string | null; location?: string | null; bhk?: number | null; size_min?: number | null; possession?: string | null }, u: any) {
  const checks: { label: string; ok: boolean; w: number }[] = [];
  const price = Number(u.price) || 0;
  if (req.budget_max || req.budget_min) {
    const lo = Number(req.budget_min) || 0, hi = Number(req.budget_max) || Infinity;
    checks.push({ label: "Budget", ok: price >= lo * 0.9 && price <= hi * 1.05, w: 30 });
  }
  const loc = (req.location || req.city || "").toLowerCase().trim();
  if (loc) checks.push({ label: "Location", ok: [u.city, u.location, u.address, u.re_projects?.location, u.re_projects?.city].filter(Boolean).some((x: string) => x.toLowerCase().includes(loc) || loc.includes(x.toLowerCase())), w: 25 });
  if (req.bhk) checks.push({ label: "BHK", ok: Number(u.bhk ?? u.bedrooms) === Number(req.bhk), w: 20 });
  if (req.size_min) checks.push({ label: "Size", ok: Number(u.super_area ?? u.area_sqft) >= Number(req.size_min) * 0.95, w: 15 });
  if (req.possession) {
    const want = req.possession.toLowerCase();
    const ready = (u.construction_status ?? "").toLowerCase().includes("ready");
    checks.push({ label: "Possession", ok: want.includes("ready") ? ready : true, w: 10 });
  }
  const total = checks.reduce((a, c) => a + c.w, 0) || 1;
  const got = checks.filter((c) => c.ok).reduce((a, c) => a + c.w, 0);
  return { score: Math.round((got / total) * 100), checks };
}

/** Pick the first active assignment rule matching the lead. */
export function pickRule(rules: any[], lead: any) {
  const b = Number(lead.budget_max || lead.budget_min) || 0;
  return rules.filter((r) => r.active).sort((a, b2) => a.priority - b2.priority).find((r) =>
    (!r.city || (lead.preferred_city ?? "").toLowerCase().includes(r.city.toLowerCase())) &&
    (!r.segment || r.segment === (lead.segment ?? "Residential")) &&
    (!r.budget_min || b >= Number(r.budget_min)) &&
    (!r.budget_max || b <= Number(r.budget_max)));
}

/** Simple duplicate finder by phone / email. */
export function duplicatesOf(lead: any, all: any[]) {
  const p = normPhone(lead.phone), e = (lead.email ?? "").toLowerCase();
  return all.filter((x) => x.id !== lead.id && ((p && [x.phone, x.alt_phone, x.whatsapp].some((y) => normPhone(y) === p)) || (e && (x.email ?? "").toLowerCase() === e)));
}
