import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DIST_GROUP = "distribution";
export const LEVELS = ["Super Distributor", "Distributor", "Dealer", "Retailer"] as const;
export const ONBOARDING = ["Lead", "Application", "KYC", "Verification", "Agreement", "Credit", "Active"] as const;
export const ORDER_STATUS = ["Pending", "Approved", "Dispatched", "Delivered", "Cancelled"] as const;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const sb = supabase as any;

function useTable<T = any>(table: string, select = "*", order = "created_at", asc = false) {
  return useQuery({
    queryKey: ["dist", table],
    queryFn: async () => {
      const { data, error } = await sb.from(table).select(select).order(order, { ascending: asc }).limit(2000);
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}
export const usePartners = () => useTable("dist_partners", "*", "name", true);
export const useProducts = () => useTable("dist_products", "*", "name", true);
export const useOrders = () => useTable("dist_orders", "*, dist_partners(name), dist_order_items(*, dist_products(name, sku))", "created_at");
export const useSchemes = () => useTable("dist_schemes", "*, dist_products(name)");
export const useCollections = () => useTable("dist_collections", "*, dist_partners(name)", "collected_on");
export const useTargets = () => useTable("dist_targets", "*");
export const useVisits = () => useTable("dist_visits", "*, dist_partners(name)", "checked_in_at");
export const useBeats = () => useTable("dist_beats", "*", "weekday", true);
export const useLoyalty = () => useTable("dist_loyalty", "*, dist_partners(name)");

export function useInvalidateDist() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["dist"] });
}
export const distDb = sb;

export const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
export const lakh = (n: number) => (Math.abs(n) >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : Math.abs(n) >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : inr(n));

/** Outstanding per partner: dispatched/delivered orders minus collections. */
export function outstandingMap(orders: any[], collections: any[]) {
  const m: Record<string, { billed: number; paid: number; oldestUnpaid: string | null }> = {};
  for (const o of orders) {
    if (!o.partner_id || !["Dispatched", "Delivered"].includes(o.status)) continue;
    const r = (m[o.partner_id] ??= { billed: 0, paid: 0, oldestUnpaid: null });
    r.billed += Number(o.total);
    if (!r.oldestUnpaid || o.order_date < r.oldestUnpaid) r.oldestUnpaid = o.order_date;
  }
  for (const c of collections) { if (c.status === "Pending") continue; const r = (m[c.partner_id] ??= { billed: 0, paid: 0, oldestUnpaid: null }); r.paid += Number(c.amount); }
  return m;
}

/** Apply active schemes to cart lines. Returns priced lines + order discount. */
export function priceCart(lines: { product_id: string; qty: number }[], products: any[], schemes: any[], level?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const active = schemes.filter((s) => s.active && (!s.starts_on || s.starts_on <= today) && (!s.ends_on || s.ends_on >= today) && (s.applies_to === "All" || !level || s.applies_to === level));
  const priced = lines.filter((l) => l.qty > 0).map((l) => {
    const p = products.find((x) => x.id === l.product_id);
    const price = Number(p?.price ?? 0);
    let free = 0; let scheme: string | null = null;
    const q = active.find((s) => s.kind === "Quantity" && s.product_id === l.product_id && s.buy_qty > 0);
    if (q && l.qty >= q.buy_qty) { free = Math.floor(l.qty / q.buy_qty) * (q.free_qty || 0); scheme = q.name; }
    return { ...l, price, free_qty: free, scheme, line_total: price * l.qty, name: p?.name ?? "?" };
  });
  const subtotal = priced.reduce((a, l) => a + l.line_total, 0);
  let discount = 0; const valueSchemes: string[] = [];
  for (const s of active.filter((s) => s.kind === "Value" && s.min_value && subtotal >= s.min_value)) {
    discount += subtotal * (Number(s.discount_pct) || 0) / 100; valueSchemes.push(s.name);
  }
  return { lines: priced, subtotal, discount: Math.round(discount), total: Math.round(subtotal - discount), valueSchemes };
}
